const axios = require('axios');
const xml2js = require('xml2js');
const { maker: cbsApi } = require('./src/services/cbs.api');

const API_URL = 'http://135.181.33.13:3002/api/loan';

// Client details from our previous test
const testData = {
    nin: '357241982110',
    checkNumber: 'CHK1762366192110',
    applicationNumber: 'APP1762366192110',
    loanNumber: 'LOAN1762366197802',
    firstName: 'Pelagia',
    lastName: 'Ngowi',
    dateOfBirth: '1985-06-15'
};

async function searchClientByExternalId(externalId) {
    try {
        console.log(`Searching for client with NIN: ${externalId}`);
        const response = await cbsApi.get(`/v1/clients?externalId=${externalId}`);
        console.log('Search response:', JSON.stringify(response, null, 2));
        return response;
    } catch (error) {
        console.error('Error searching client:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        return null;
    }
}

async function verifyLoanFinalApproval() {
    const finalApprovalXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document>
  <Data>
    <Header>
      <Sender>ESS_UTUMISHI</Sender>
      <Receiver>ZE DONE</Receiver>
      <FSPCode>FL8090</FSPCode>
      <MsgId>TEST_VERIFY_${Date.now()}</MsgId>
      <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
    </Header>
    <MessageDetails>
      <ApplicationNumber>${testData.applicationNumber}</ApplicationNumber>
      <FSPReferenceNumber>${testData.loanNumber}</FSPReferenceNumber>
      <LoanNumber>${testData.loanNumber}</LoanNumber>
      <Approval>APPROVED</Approval>
      <NIN>${testData.nin}</NIN>
      <FirstName>${testData.firstName}</FirstName>
      <LastName>${testData.lastName}</LastName>
      <MobileNo>255789123456</MobileNo>
      <Sex>F</Sex>
      <DateOfBirth>${testData.dateOfBirth}</DateOfBirth>
      <EmploymentDate>2015-01-01</EmploymentDate>
      <BankAccountNumber>1122334455</BankAccountNumber>
      <SwiftCode>TESTSWFT</SwiftCode>
      <CheckNumber>${testData.checkNumber}</CheckNumber>
      <RequestedAmount>3000000</RequestedAmount>
      <ProductCode>17</ProductCode>
      <Tenure>24</Tenure>
      <InterestRate>28</InterestRate>
      <ProcessingFee>500</ProcessingFee>
      <Insurance>200</Insurance>
      <ApprovalDate>2025-11-05</ApprovalDate>
    </MessageDetails>
  </Data>
</Document>`;

    try {
        console.log('\n1. Verifying if client exists...');
        const clientData = await searchClientByExternalId(testData.nin);
        
        console.log('\n2. Sending verification LOAN_FINAL_APPROVAL_NOTIFICATION...');
        const response = await axios.post(API_URL, finalApprovalXML, {
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        console.log('\n3. Response from final approval:', response.data);
        
        // Add a delay to allow for client creation
        console.log('\n4. Waiting for client creation process...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('\n5. Checking if client was created...');
        const updatedClientData = await searchClientByExternalId(testData.nin);
        
        return {
            initialClientCheck: clientData,
            finalApprovalResponse: response.data,
            finalClientCheck: updatedClientData
        };
    } catch (error) {
        console.error('Error in verification:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
}

// Run the verification
console.log('🔍 Starting client creation verification...\n');
verifyLoanFinalApproval()
    .then(result => {
        console.log('\n✅ Verification completed!');
    })
    .catch(error => {
        console.error('\n❌ Verification failed:', error.message);
    });