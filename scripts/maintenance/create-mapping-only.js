require('dotenv').config();
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');

async function createLoanMappingOnly() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore');
        console.log('✅ Connected to MongoDB\n');

        const applicationNumber = 'ESS1765974145523';
        const loanNumber = 'LOAN1765963593440577';
        const fspReferenceNumber = '11915366';

        console.log('📋 Creating loan mapping for:');
        console.log('   Application Number:', applicationNumber);
        console.log('   Loan Number:', loanNumber);
        console.log('   FSP Reference Number:', fspReferenceNumber);
        console.log('');

        // Check if mapping already exists
        const existing = await LoanMapping.findOne({ essApplicationNumber: applicationNumber });
        
        if (existing) {
            console.log('⚠️  Loan mapping already exists!');
            console.log('   ID:', existing._id);
            console.log('   Status:', existing.status);
            console.log('   Created:', existing.createdAt);
            console.log('');
            console.log('✅ Updating existing mapping...');
            
            existing.essLoanNumberAlias = loanNumber;
            existing.fspReferenceNumber = fspReferenceNumber;
            existing.status = 'FINAL_APPROVAL_RECEIVED';
            existing.metadata = {
                ...existing.metadata,
                finalApprovalReceivedAt: new Date().toISOString(),
                updatedVia: 'manual_script_update'
            };
            await existing.save();
            console.log('✅ Loan mapping updated successfully\n');
        } else {
            console.log('➕ Creating new loan mapping...');
            const mapping = new LoanMapping({
                essApplicationNumber: applicationNumber,
                essCheckNumber: fspReferenceNumber,
                fspReferenceNumber: fspReferenceNumber,
                essLoanNumberAlias: loanNumber,
                productCode: '17',
                requestedAmount: 5000000,
                tenure: 60,
                status: 'FINAL_APPROVAL_RECEIVED',
                metadata: {
                    createdVia: 'manual_script',
                    finalApprovalReceivedAt: new Date().toISOString(),
                    note: 'Created manually - CBS integration pending'
                }
            });
            await mapping.save();
            console.log('✅ Loan mapping created successfully');
            console.log('   ID:', mapping._id);
            console.log('   Status:', mapping.status);
            console.log('');
        }

        console.log('🎉 Done! The loan mapping is now in the database.');
        console.log('');
        console.log('📝 Next Steps:');
        console.log('   1. The system will now handle future LOAN_FINAL_APPROVAL requests');
        console.log('   2. CBS client and loan creation will happen automatically');
        console.log('   3. Check PM2 logs to verify: pm2 logs ess-app');
        console.log('');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

createLoanMappingOnly();
