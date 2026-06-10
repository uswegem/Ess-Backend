require('dotenv').config();
const { MongoClient } = require('mongodb');
const { sendCallback } = require('./src/utils/callbackUtils');

const MONGODB_URI = 'mongodb://localhost:27017/miracore';

async function resendDisbursementNotification() {
  let mongoClient;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('📤 RESENDING DISBURSEMENT NOTIFICATION FOR ESS1766057696092');
    console.log('='.repeat(80) + '\n');

    // Connect to MongoDB
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = mongoClient.db();
    const loanMappingsCollection = db.collection('loanmappings');

    // Get loan mapping
    const loanMapping = await loanMappingsCollection.findOne({
      essApplicationNumber: 'ESS1766057696092'
    });

    if (!loanMapping) {
      console.error('❌ Loan mapping not found for ESS1766057696092');
      return;
    }

    console.log('📋 Loan Mapping Found:');
    console.log(`   Application Number: ${loanMapping.essApplicationNumber}`);
    console.log(`   Loan Number: ${loanMapping.essLoanNumberAlias}`);
    console.log(`   FSP Reference: ${loanMapping.fspReferenceNumber}`);
    console.log(`   Status: ${loanMapping.status}`);
    console.log(`   Client ID: ${loanMapping.mifosClientId}`);
    console.log(`   Loan ID: ${loanMapping.mifosLoanId}`);
    console.log(`   Amount: ${loanMapping.requestedAmount} TZS\n`);

    // Prepare disbursement notification callback data (with Data wrapper)
    const callbackData = {
      Data: {
        Header: {
          Sender: process.env.FSP_NAME || 'ZE DONE',
          Receiver: 'ESS_UTUMISHI',
          FSPCode: process.env.FSP_CODE || 'FL8090',
          MsgId: `LDIS_RESEND_${Date.now()}`,
          MessageType: 'LOAN_DISBURSEMENT_NOTIFICATION'
        },
        MessageDetails: {
          ApplicationNumber: loanMapping.essApplicationNumber,
          Reason: 'Loan successfully disbursed - resending notification with fixed XML structure',
          FSPReferenceNumber: loanMapping.fspReferenceNumber,
          LoanNumber: loanMapping.essLoanNumberAlias,
          TotalAmountToPay: loanMapping.requestedAmount,
          DisbursementDate: new Date().toISOString().replace('Z', '')
        }
      }
    };

    console.log('📤 Sending disbursement notification...\n');
    console.log('Callback Data:');
    console.log(JSON.stringify(callbackData, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Send callback
    const response = await sendCallback(callbackData);

    console.log('✅ Response received:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Data:\n${response.data}\n`);

    console.log('='.repeat(80));
    console.log('✅ DISBURSEMENT NOTIFICATION SENT SUCCESSFULLY');
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

resendDisbursementNotification();
