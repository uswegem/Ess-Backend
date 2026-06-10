const axios = require('axios');

// Test script to validate end-to-end loan mapping flow
async function testLoanMappingFlow() {
    const baseURL = 'http://135.181.33.13:3002/api/loan';
    const timestamp = Date.now();

    console.log('🧪 Testing End-to-End Loan Mapping Flow\n');

    try {
        // Step 1: Send LOAN_OFFER_REQUEST (creates mapping)
        console.log('📤 Step 1: Sending LOAN_OFFER_REQUEST...');
        const offerRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_OFFER_${timestamp}</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${timestamp}</CheckNumber>
            <FirstName>John</FirstName>
            <LastName>Doe</LastName>
            <Sex>M</Sex>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1400000</NetSalary>
            <OneThirdAmount>500000</OneThirdAmount>
            <DeductibleAmount>100000</DeductibleAmount>
            <RetirementDate>2050-01-01</RetirementDate>
            <RequestedAmount>7000000</RequestedAmount>
            <DesiredDeductibleAmount>80000</DesiredDeductibleAmount>
            <Tenure>84</Tenure>
            <ProductCode>17</ProductCode>
            <InterestRate>28</InterestRate>
            <ProcessingFee>500</ProcessingFee>
            <Insurance>200</Insurance>
            <ApplicationNumber>APP${timestamp}</ApplicationNumber>
            <MobileNo>07${String(timestamp).slice(-7)}</MobileNo>
            <NIN>${timestamp}123456789</NIN>
        </MessageDetails>
    </Data>
</Document>`;

        const offerResponse = await axios.post(baseURL, offerRequest, {
            headers: { 'Content-Type': 'application/xml' }
        });
        console.log('✅ LOAN_OFFER_REQUEST sent successfully');

        // Step 2: Send LOAN_FINAL_APPROVAL_NOTIFICATION (updates mapping)
        console.log('\n📤 Step 2: Sending LOAN_FINAL_APPROVAL_NOTIFICATION...');
        const approvalRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>APPROVAL_${timestamp}</MsgId>
            <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>APP${timestamp}</ApplicationNumber>
            <FSPReferenceNumber>FSP${timestamp}</FSPReferenceNumber>
            <LoanNumber>LOAN${timestamp}</LoanNumber>
            <Approval>APPROVED</Approval>
            <NIN>${timestamp}123456789</NIN>
            <FirstName>John</FirstName>
            <LastName>Doe</LastName>
            <MobileNo>07${String(timestamp).slice(-7)}</MobileNo>
            <Sex>M</Sex>
            <DateOfBirth>1980-01-01</DateOfBirth>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <BankAccountNumber>1234567890</BankAccountNumber>
            <SwiftCode>SWIFTTZTZ</SwiftCode>
            <CheckNumber>CHK${timestamp}</CheckNumber>
            <RequestedAmount>7000000</RequestedAmount>
            <ProductCode>17</ProductCode>
            <Tenure>84</Tenure>
            <InterestRate>28</InterestRate>
            <ProcessingFee>500</ProcessingFee>
            <Insurance>200</Insurance>
        </MessageDetails>
    </Data>
</Document>`;

        const approvalResponse = await axios.post(baseURL, approvalRequest, {
            headers: { 'Content-Type': 'application/xml' }
        });
        console.log('✅ LOAN_FINAL_APPROVAL_NOTIFICATION sent successfully');

        console.log('\n🎉 End-to-End Flow Completed Successfully!');
        console.log('\n📊 Validation Steps:');
        console.log('1. Check server logs for mapping creation/update messages');
        console.log('2. Verify MongoDB loanmappings collection has the new record');
        console.log('3. Confirm MIFOS has the client and loan created');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testLoanMappingFlow();