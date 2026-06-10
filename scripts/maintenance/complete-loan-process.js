const mongoose = require('mongoose');
const { maker: cbsApi } = require('./src/services/cbs.api');
const logger = require('./src/utils/logger');
require('dotenv').config();

// Client and loan details
const clientId = 53;
const applicationNumber = "ESS1763982075940";
const loanData = {
    requestedAmount: "4800000.00",
    tenure: "96",
    productCode: "17",
    interestRate: "28", // CBS requires 28%
    processingFee: "100000.00",
    insurance: "50000.00"
};

/**
 * Create loan in CBS
 */
async function createLoan() {
    try {
        console.log('💰 Creating Loan in CBS...');
        console.log(`   Client ID: ${clientId}`);
        console.log(`   Principal: ${loanData.requestedAmount}`);
        console.log(`   Tenure: ${loanData.tenure} months`);
        console.log(`   Interest Rate: ${loanData.interestRate}%\n`);
        
        const loanPayload = {
            clientId: clientId,
            productId: 17, // ESS Loan product
            principal: parseFloat(loanData.requestedAmount).toString(),
            loanTermFrequency: parseInt(loanData.tenure),
            loanTermFrequencyType: 2, // Months
            numberOfRepayments: parseInt(loanData.tenure),
            repaymentEvery: 1,
            repaymentFrequencyType: 2, // Monthly
            interestRatePerPeriod: parseFloat(loanData.interestRate),
            interestRateFrequencyType: 3, // Per year
            amortizationType: 1, // Equal installments
            interestType: 0, // Declining balance
            interestCalculationPeriodType: 1, // Same as repayment
            transactionProcessingStrategyCode: "mifos-standard-strategy",
            loanType: "individual", // Required field
            expectedDisbursementDate: new Date().toISOString().split('T')[0],
            submittedOnDate: new Date().toISOString().split('T')[0],
            dateFormat: "yyyy-MM-dd",
            locale: "en"
        };
        
        console.log('📄 Loan payload:', JSON.stringify(loanPayload, null, 2));
        
        const loanResponse = await cbsApi.post('/v1/loans', loanPayload);
        
        if (loanResponse.status && loanResponse.response?.loanId) {
            const loanId = loanResponse.response.loanId;
            console.log(`✅ Loan created successfully with ID: ${loanId}`);
            return loanId;
        } else {
            throw new Error('Failed to create loan: ' + JSON.stringify(loanResponse));
        }
        
    } catch (error) {
        console.error('❌ Error creating loan:', error.message);
        if (error.response?.data) {
            console.error('CBS Response:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

/**
 * Approve loan in CBS
 */
async function approveLoan(loanId) {
    try {
        console.log(`\n📋 Approving loan ${loanId}...`);
        
        const approvePayload = {
            approvedOnDate: new Date().toISOString().split('T')[0],
            dateFormat: "yyyy-MM-dd",
            locale: "en",
            note: "ESS Loan approved automatically"
        };
        
        console.log('📄 Approval payload:', JSON.stringify(approvePayload, null, 2));
        
        const approveResponse = await cbsApi.post(`/v1/loans/${loanId}?command=approve`, approvePayload);
        
        if (approveResponse.status) {
            console.log(`✅ Loan ${loanId} approved successfully`);
            return true;
        } else {
            throw new Error('Failed to approve loan: ' + JSON.stringify(approveResponse));
        }
        
    } catch (error) {
        console.error('❌ Error approving loan:', error.message);
        if (error.response?.data) {
            console.error('CBS Response:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

/**
 * Disburse loan in CBS
 */
async function disburseLoan(loanId) {
    try {
        console.log(`\n💸 Disbursing loan ${loanId}...`);
        
        const disbursePayload = {
            actualDisbursementDate: new Date().toISOString().split('T')[0],
            transactionAmount: parseFloat(loanData.requestedAmount),
            paymentTypeId: 1, // Cash
            dateFormat: "yyyy-MM-dd",
            locale: "en",
            note: "ESS Loan disbursed automatically"
        };
        
        console.log('📄 Disbursement payload:', JSON.stringify(disbursePayload, null, 2));
        
        const disburseResponse = await cbsApi.post(`/v1/loans/${loanId}?command=disburse`, disbursePayload);
        
        if (disburseResponse.status) {
            console.log(`✅ Loan ${loanId} disbursed successfully`);
            return true;
        } else {
            throw new Error('Failed to disburse loan: ' + JSON.stringify(disburseResponse));
        }
        
    } catch (error) {
        console.error('❌ Error disbursing loan:', error.message);
        if (error.response?.data) {
            console.error('CBS Response:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

/**
 * Update loan mapping with CBS loan details
 */
async function updateLoanMappingWithLoan(loanId) {
    try {
        console.log(`\n📝 Updating loan mapping with loan ID ${loanId}...`);
        
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/miracore");
        
        const updateResult = await mongoose.connection.db.collection("loanmappings").updateOne(
            { essApplicationNumber: applicationNumber },
            {
                $set: {
                    mifosLoanId: loanId,
                    "metadata.loanCreatedAt": new Date().toISOString(),
                    "metadata.loanApprovedAt": new Date().toISOString(),
                    "metadata.loanDisbursedAt": new Date().toISOString(),
                    "metadata.cbsLoanDetails": {
                        loanId: loanId,
                        principal: loanData.requestedAmount,
                        tenure: loanData.tenure,
                        interestRate: loanData.interestRate,
                        status: "DISBURSED"
                    }
                }
            }
        );
        
        console.log('✅ Loan mapping updated:', updateResult);
        
        await mongoose.connection.close();
        
    } catch (error) {
        console.error('❌ Error updating loan mapping:', error.message);
        throw error;
    }
}

/**
 * Get loan details from CBS
 */
async function getLoanDetails(loanId) {
    try {
        console.log(`\n📊 Getting loan details for loan ${loanId}...`);
        
        const loanDetails = await cbsApi.get(`/v1/loans/${loanId}`);
        
        if (loanDetails.status && loanDetails.response) {
            console.log('✅ Loan details retrieved:');
            console.log(`   Loan Account No: ${loanDetails.response.accountNo}`);
            console.log(`   Status: ${loanDetails.response.status?.value}`);
            console.log(`   Principal: ${loanDetails.response.principal}`);
            console.log(`   Total Outstanding: ${loanDetails.response.summary?.totalOutstanding || 'N/A'}`);
            return loanDetails.response;
        }
        
    } catch (error) {
        console.error('❌ Error getting loan details:', error.message);
    }
}

/**
 * Main execution function
 */
async function processLoanCreationFlow() {
    try {
        console.log('🏦 STARTING LOAN CREATION, APPROVAL & DISBURSEMENT PROCESS');
        console.log('='.repeat(70));
        console.log(`📋 Application: ${applicationNumber}`);
        console.log(`👤 Client ID: ${clientId}`);
        console.log(`💰 Loan Amount: ${loanData.requestedAmount}`);
        console.log(`📅 Tenure: ${loanData.tenure} months`);
        console.log(`📈 Interest Rate: ${loanData.interestRate}%\n`);
        
        // Step 1: Create loan
        const loanId = await createLoan();
        
        // Step 2: Approve loan
        await approveLoan(loanId);
        
        // Step 3: Disburse loan
        await disburseLoan(loanId);
        
        // Step 4: Update loan mapping
        await updateLoanMappingWithLoan(loanId);
        
        // Step 5: Get final loan details
        const finalLoanDetails = await getLoanDetails(loanId);
        
        console.log('\n🎉 SUCCESS! LOAN PROCESS COMPLETED');
        console.log('='.repeat(70));
        console.log(`✅ Client ID: ${clientId}`);
        console.log(`✅ Loan ID: ${loanId}`);
        console.log(`✅ Application: ${applicationNumber}`);
        console.log(`✅ Status: ${finalLoanDetails?.status?.value || 'PROCESSED'}`);
        console.log(`✅ Account No: ${finalLoanDetails?.accountNo || 'N/A'}`);
        console.log('✅ Loan mapping updated with CBS IDs');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ FAILED! Loan process failed');
        console.error('='.repeat(70));
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the loan process
processLoanCreationFlow();