require('dotenv').config();
const { MongoClient } = require('mongodb');
const { sendCallback } = require('./src/utils/callbackUtils');

const MONGODB_URI = 'mongodb://localhost:27017/miracore';

async function resendInitialApproval() {
  let mongoClient;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('📤 RESENDING LOAN_INITIAL_APPROVAL_NOTIFICATION FOR ESS1766062791345');
    console.log('='.repeat(80) + '\n');

    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = mongoClient.db();
    const loanMappingsCollection = db.collection('loanmappings');

    const loanMapping = await loanMappingsCollection.findOne({
      essApplicationNumber: 'ESS1766062791345'
    });

    if (!loanMapping) {
      console.error('❌ Loan mapping not found for ESS1766062791345');
      return;
    }

    console.log('📋 Loan Mapping Found:');
    console.log(`   Application Number: ${loanMapping.essApplicationNumber}`);
    console.log(`   Check Number: ${loanMapping.checkNumber}`);
    console.log(`   FSP Reference: ${loanMapping.fspReferenceNumber || 'Not set'}`);
    console.log(`   Loan Number: ${loanMapping.essLoanNumberAlias || 'Not set'}`);
    console.log(`   Status: ${loanMapping.status}`);
    console.log(`   Requested Amount: ${loanMapping.requestedAmount} TZS`);
    console.log(`   Product Code: ${loanMapping.productCode || 'Not set'}\n`);

    // Use existing loan mapping data or create new
    const loanNumber = loanMapping.essLoanNumberAlias || `LOAN${Date.now()}`;
    const fspReferenceNumber = loanMapping.fspReferenceNumber || `FSP${Date.now()}`;
    const requestedAmount = loanMapping.requestedAmount || 2500000;
    
    // Calculate with proper logic
    const tenure = 96;
    const interestRate = 0.24; // 24% annual
    const monthlyRate = interestRate / 12;
    const totalInterest = requestedAmount * interestRate * tenure / 12;
    const totalAmountToPay = requestedAmount + totalInterest;
    const otherCharges = 50000;

    console.log('💰 Calculated Values:');
    console.log(`   Loan Amount: ${requestedAmount.toFixed(2)} TZS`);
    console.log(`   Tenure: ${tenure} months`);
    console.log(`   Interest Rate: ${(interestRate * 100).toFixed(0)}% per annum`);
    console.log(`   Total Interest: ${totalInterest.toFixed(2)} TZS`);
    console.log(`   Total Amount To Pay: ${totalAmountToPay.toFixed(2)} TZS`);
    console.log(`   Other Charges: ${otherCharges.toFixed(2)} TZS\n`);

    const callbackData = {
      Data: {
        Header: {
          Sender: process.env.FSP_NAME || 'ZE DONE',
          Receiver: 'ESS_UTUMISHI',
          FSPCode: process.env.FSP_CODE || 'FL8090',
          MsgId: `LIAN_RESEND_${Date.now()}`,
          MessageType: 'LOAN_INITIAL_APPROVAL_NOTIFICATION'
        },
        MessageDetails: {
          ApplicationNumber: loanMapping.essApplicationNumber,
          Reason: 'Top-Up Loan Request Approved (Resending with fixed XML structure)',
          FSPReferenceNumber: fspReferenceNumber,
          LoanNumber: loanNumber,
          TotalAmountToPay: totalAmountToPay.toFixed(2),
          OtherCharges: otherCharges.toFixed(2),
          Approval: 'APPROVED'
        }
      }
    };

    console.log('📤 Sending LOAN_INITIAL_APPROVAL_NOTIFICATION...\n');
    console.log('Callback Data:');
    console.log(JSON.stringify(callbackData, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    const response = await sendCallback(callbackData);

    console.log('✅ Response received:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Data:\n${response.data}\n`);

    console.log('='.repeat(80));
    console.log('✅ LOAN_INITIAL_APPROVAL_NOTIFICATION SENT SUCCESSFULLY');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

resendInitialApproval();
