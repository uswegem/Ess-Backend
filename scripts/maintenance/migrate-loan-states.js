/**
 * Migration Script: Update Loan States
 * 
 * Purpose: Migrate existing loans to new state model
 * - Add COMPLETED status to fully repaid loans
 * - Add WAITING_FOR_LIQUIDATION for takeover loans
 * - Backfill actor information where possible
 * 
 * Run: node migrate-loan-states.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');
const { maker: cbsApi } = require('./src/services/cbs.api');
const logger = require('./src/utils/logger');

const DRY_RUN = process.argv.includes('--dry-run');

async function migrateLoanStates() {
    console.log('🔄 Starting Loan State Migration');
    console.log('=' .repeat(70));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be saved)' : 'LIVE UPDATE'}`);
    console.log('=' .repeat(70));

    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const stats = {
            total: 0,
            completed: 0,
            waitingLiquidation: 0,
            actorBackfilled: 0,
            errors: 0,
            skipped: 0
        };

        // Step 1: Find all DISBURSED loans and check if they're completed in Mifos
        console.log('\n📋 Step 1: Checking DISBURSED loans for completion...\n');
        const disbursedLoans = await LoanMapping.find({ 
            status: 'DISBURSED',
            mifosLoanId: { $exists: true, $ne: null }
        });

        stats.total = disbursedLoans.length;
        console.log(`Found ${disbursedLoans.length} disbursed loans to check`);

        for (const loan of disbursedLoans) {
            try {
                console.log(`\n🔍 Checking loan ${loan.essApplicationNumber} (Mifos ID: ${loan.mifosLoanId})`);

                // Fetch loan details from Mifos
                const response = await cbsApi.get(`/v1/loans/${loan.mifosLoanId}`);
                const mifosLoan = response.data;

                console.log(`   Status in Mifos: ${mifosLoan.status?.value}`);
                console.log(`   Outstanding: ${mifosLoan.summary?.totalOutstanding || 0}`);

                // Check if loan is closed/completed in Mifos
                const isCompleted = ['closed', 'overpaid', 'withdrawn', 'written off'].includes(
                    mifosLoan.status?.value?.toLowerCase()
                );

                const isFullyRepaid = mifosLoan.summary?.totalOutstanding === 0 && 
                                     mifosLoan.status?.value?.toLowerCase() === 'closed';

                if (isCompleted || isFullyRepaid) {
                    console.log(`   ✅ Loan is completed - updating to COMPLETED status`);
                    
                    if (!DRY_RUN) {
                        loan.status = 'COMPLETED';
                        loan.completedAt = mifosLoan.timeline?.closedOnDate 
                            ? new Date(mifosLoan.timeline.closedOnDate) 
                            : new Date();
                        await loan.save();
                    }
                    
                    stats.completed++;
                } else {
                    console.log(`   ℹ️  Loan still active - no change needed`);
                    stats.skipped++;
                }

                // Small delay to avoid overwhelming Mifos API
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`   ❌ Error checking loan ${loan.essApplicationNumber}:`, error.message);
                stats.errors++;
            }
        }

        // Step 2: Identify takeover loans waiting for liquidation
        console.log('\n\n📋 Step 2: Checking for takeover loans awaiting liquidation...\n');
        
        const takeoverLoans = await LoanMapping.find({
            originalMessageType: 'LOAN_TAKEOVER_OFFER_REQUEST',
            status: { $in: ['APPROVED', 'FINAL_APPROVAL_RECEIVED'] }
        });

        console.log(`Found ${takeoverLoans.length} takeover loans in pre-disbursement state`);

        for (const loan of takeoverLoans) {
            try {
                console.log(`\n🔍 Checking takeover loan ${loan.essApplicationNumber}`);

                // If loan has mifosLoanId but status is still APPROVED/FINAL_APPROVAL_RECEIVED,
                // it might be waiting for liquidation
                if (loan.mifosLoanId) {
                    const response = await cbsApi.get(`/v1/loans/${loan.mifosLoanId}`);
                    const mifosLoan = response.data;

                    console.log(`   Mifos Status: ${mifosLoan.status?.value}`);

                    // If loan is still pending approval in Mifos, it's likely waiting for liquidation
                    if (mifosLoan.status?.value === 'Submitted and pending approval') {
                        console.log(`   ✅ Setting to WAITING_FOR_LIQUIDATION`);
                        
                        if (!DRY_RUN) {
                            loan.status = 'WAITING_FOR_LIQUIDATION';
                            loan.liquidationRequestedAt = new Date();
                            await loan.save();
                        }
                        
                        stats.waitingLiquidation++;
                    } else {
                        stats.skipped++;
                    }
                } else {
                    console.log(`   ℹ️  No Mifos loan ID - skipping`);
                    stats.skipped++;
                }

                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`   ❌ Error checking takeover loan ${loan.essApplicationNumber}:`, error.message);
                stats.errors++;
            }
        }

        // Step 3: Backfill actor information from metadata where possible
        console.log('\n\n📋 Step 3: Backfilling actor information...\n');
        
        const rejectedLoans = await LoanMapping.find({
            status: 'REJECTED',
            rejectedBy: { $exists: false }
        });

        const cancelledLoans = await LoanMapping.find({
            status: 'CANCELLED',
            cancelledBy: { $exists: false }
        });

        console.log(`Found ${rejectedLoans.length} rejected loans without actor info`);
        console.log(`Found ${cancelledLoans.length} cancelled loans without actor info`);

        for (const loan of rejectedLoans) {
            // Try to infer actor from metadata or default to SYSTEM
            const actor = loan.metadata?.rejectedBy || 'SYSTEM';
            const reason = loan.metadata?.rejectionReason || 'Historical rejection - actor unknown';
            
            console.log(`   Setting rejectedBy=${actor} for ${loan.essApplicationNumber}`);
            
            if (!DRY_RUN) {
                loan.rejectedBy = actor;
                loan.rejectionReason = reason;
                await loan.save();
            }
            
            stats.actorBackfilled++;
        }

        for (const loan of cancelledLoans) {
            // Try to infer actor from metadata or default to SYSTEM
            const actor = loan.metadata?.cancelledBy || 'SYSTEM';
            const reason = loan.metadata?.cancellationReason || 'Historical cancellation - actor unknown';
            
            console.log(`   Setting cancelledBy=${actor} for ${loan.essApplicationNumber}`);
            
            if (!DRY_RUN) {
                loan.cancelledBy = actor;
                loan.cancellationReason = reason;
                await loan.save();
            }
            
            stats.actorBackfilled++;
        }

        // Print summary
        console.log('\n' + '='.repeat(70));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(70));
        console.log(`Total loans checked:           ${stats.total}`);
        console.log(`Updated to COMPLETED:          ${stats.completed}`);
        console.log(`Updated to WAITING_LIQUIDATION: ${stats.waitingLiquidation}`);
        console.log(`Actor info backfilled:         ${stats.actorBackfilled}`);
        console.log(`Skipped (no changes needed):   ${stats.skipped}`);
        console.log(`Errors:                        ${stats.errors}`);
        console.log('='.repeat(70));

        if (DRY_RUN) {
            console.log('\n⚠️  DRY RUN MODE - No changes were saved to database');
            console.log('Run without --dry-run flag to apply changes');
        } else {
            console.log('\n✅ Migration completed successfully!');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run migration
if (require.main === module) {
    migrateLoanStates()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = migrateLoanStates;
