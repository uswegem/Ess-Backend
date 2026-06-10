const axios = require('axios');

// Get server URL from command line argument or default to localhost
const serverURL = process.argv[2] || 'http://localhost:3002';
const apiEndpoint = `${serverURL}/api/loan`;

async function sendLoanFinalApprovalNotification() {
    console.log('🚀 Sending LOAN_FINAL_APPROVAL_NOTIFICATION to server\n');
    console.log('='.repeat(70) + '\n');

    const finalApprovalRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>FINAL_APPROVAL_TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
            <FSPReferenceNumber>FSP${Date.now()}</FSPReferenceNumber>
            <LoanNumber>LOAN${Date.now()}</LoanNumber>
            <Approval>APPROVED</Approval>
            <NIN>1234567890123456</NIN>
            <FirstName>John</FirstName>
            <LastName>Doe</LastName>
            <MobileNo>0712345678</MobileNo>
            <Sex>M</Sex>
            <DateOfBirth>1990-01-01</DateOfBirth>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <BankAccountNumber>1234567890</BankAccountNumber>
            <SwiftCode>TESTSWFT</SwiftCode>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <RequestedAmount>5000000</RequestedAmount>
            <ProductCode>17</ProductCode>
            <Tenure>24</Tenure>
            <InterestRate>28</InterestRate>
            <ProcessingFee>500</ProcessingFee>
            <Insurance>200</Insurance>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(finalApprovalRequest);
    console.log('\n📥 RESPONSE:');

    try {
        const response = await axios.post(apiEndpoint, finalApprovalRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });
        console.log('✅ Success!');
        console.log('Status:', response.status);
        console.log('Response:', response.data);
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        } else if (error.code) {
            console.log('Error Code:', error.code);
        }
    }
}

// Run the function
sendLoanFinalApprovalNotification();