require('dotenv').config();
const axios = require('axios');
const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017/miracore';
const ESS_API_URL = 'http://localhost:3002/api/loan';

async function resubmitFinalApproval() {
  let mongoClient;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔄 RESUBMITTING FINAL APPROVAL FOR ESS1766057696092');
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
    console.log(`   Client ID in MIFOS: ${loanMapping.mifosClientId || 'Not set'}`);
    console.log(`   Loan ID in MIFOS: ${loanMapping.mifosLoanId || 'Not set'}\n`);

    // Reset status to allow reprocessing
    console.log('🔄 Resetting loan status to FINAL_APPROVAL_RECEIVED...');
    await loanMappingsCollection.updateOne(
      { essApplicationNumber: 'ESS1766057696092' },
      { 
        $set: { 
          status: 'FINAL_APPROVAL_RECEIVED',
          updatedAt: new Date()
        },
        $unset: { 
          disbursedAt: '',
          disbursementDetails: ''
        }
      }
    );
    console.log('✅ Status reset complete\n');

    // Construct LOAN_FINAL_APPROVAL_NOTIFICATION XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
  <Data>
    <Header>
      <Sender>ESS_UTUMISHI</Sender>
      <Receiver>ZE DONE</Receiver>
      <FSPCode>FL8090</FSPCode>
      <MsgId>RESUBMIT_${Date.now()}</MsgId>
      <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
    </Header>
    <MessageDetails>
      <ApplicationNumber>${loanMapping.essApplicationNumber}</ApplicationNumber>
      <LoanNumber>${loanMapping.essLoanNumberAlias}</LoanNumber>
      <FSPReferenceNumber>${loanMapping.fspReferenceNumber}</FSPReferenceNumber>
      <Approval>APPROVED</Approval>
      <Reason>Resubmitting final approval after system fix - ${new Date().toISOString()}</Reason>
    </MessageDetails>
  </Data>
  <Signature>RESUBMIT_SIGNATURE</Signature>
</Document>`;

    console.log('📤 Sending LOAN_FINAL_APPROVAL_NOTIFICATION to ESS API...\n');

    // Send to ESS API
    const response = await axios.post(ESS_API_URL, xml, {
      headers: {
        'Content-Type': 'application/xml'
      },
      timeout: 30000
    });

    console.log('✅ Response received:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Data:\n${response.data}\n`);

    // Wait a bit for processing
    console.log('⏳ Waiting 5 seconds for loan creation to complete...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check updated loan mapping
    const updatedMapping = await loanMappingsCollection.findOne({
      essApplicationNumber: 'ESS1766057696092'
    });

    console.log('='.repeat(80));
    console.log('📊 UPDATED LOAN MAPPING:');
    console.log('='.repeat(80));
    console.log(`   Status: ${updatedMapping.status}`);
    console.log(`   Client ID in MIFOS: ${updatedMapping.mifosClientId || 'Not set'}`);
    console.log(`   Loan ID in MIFOS: ${updatedMapping.mifosLoanId || 'Not set'}`);
    
    if (updatedMapping.mifosLoanId) {
      console.log('\n✅ SUCCESS! Loan was created in MIFOS');
      console.log(`   MIFOS Client ID: ${updatedMapping.mifosClientId}`);
      console.log(`   MIFOS Loan ID: ${updatedMapping.mifosLoanId}`);
    } else {
      console.log('\n⚠️  Loan ID not updated - check logs for errors');
    }

    console.log('\n' + '='.repeat(80) + '\n');

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

resubmitFinalApproval();
