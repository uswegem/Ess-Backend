require('dotenv').config();
const axios = require('axios');
const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017/miracore';
const API_URL = 'http://localhost:3002/api/loan/disburse';

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

    // Prepare disbursement notification data
    const notificationData = {
      applicationNumber: loanMapping.essApplicationNumber,
      loanNumber: loanMapping.essLoanNumberAlias,
      fspReferenceNumber: loanMapping.fspReferenceNumber,
      amount: loanMapping.requestedAmount,
      totalAmountToPay: loanMapping.requestedAmount,
      reason: 'Loan successfully disbursed - resending notification'
    };

    console.log('📤 Sending disbursement notification to API...\n');
    console.log('Notification Data:');
    console.log(JSON.stringify(notificationData, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Send to API endpoint
    const response = await axios.post(API_URL, notificationData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Response received:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Data:\n${JSON.stringify(response.data, null, 2)}\n`);

    console.log('='.repeat(80));
    console.log('✅ DISBURSEMENT NOTIFICATION SENT SUCCESSFULLY');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
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
