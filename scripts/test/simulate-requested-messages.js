const axios = require('axios');

async function simulateRequestedMessages() {
    console.log('🚀 Simulating Requested Message Types\n');
    console.log('='.repeat(80) + '\n');

    // 1. LOAN_CHARGES_REQUEST
    console.log('📋 1. LOAN_CHARGES_REQUEST');
    console.log('-'.repeat(60));

    const loanChargesRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>CHARGES_TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <DesignationCode>D001</DesignationCode>
            <DesignationName>Teacher</DesignationName>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1400000</NetSalary>
            <OneThirdAmount>500000</OneThirdAmount>
            <DeductibleAmount>100000</DeductibleAmount>
            <RetirementDate>2050-01-01</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
            <RequestedAmount>5000000</RequestedAmount>
            <DesiredDeductibleAmount>150000</DesiredDeductibleAmount>
            <Tenure>24</Tenure>
            <ProductCode>17</ProductCode>
            <VoteCode>V001</VoteCode>
            <TotalEmployeeDeduction>100000</TotalEmployeeDeduction>
            <JobClassCode>J001</JobClassCode>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(loanChargesRequest);
    console.log('\n📥 RESPONSE XML:');

    try {
        const response1 = await axios.post('http://localhost:3002/api/loan', loanChargesRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });
        console.log(response1.data);
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        }
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // 2. LOAN_OFFER_REQUEST
    console.log('📋 2. LOAN_OFFER_REQUEST');
    console.log('-'.repeat(60));

    const loanOfferRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>OFFER_TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <FirstName>John</FirstName>
            <MiddleName></MiddleName>
            <LastName>Doe</LastName>
            <Sex>M</Sex>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <MaritalStatus>Single</MaritalStatus>
            <BankAccountNumber>123456789</BankAccountNumber>
            <VoteCode>V001</VoteCode>
            <VoteName>Education Vote</VoteName>
            <NIN>12345678901234567890</NIN>
            <DesignationCode>D001</DesignationCode>
            <DesignationName>Teacher</DesignationName>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1400000</NetSalary>
            <OneThirdAmount>500000</OneThirdAmount>
            <TotalEmployeeDeduction>100000</TotalEmployeeDeduction>
            <RetirementDate>2050-01-01</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
            <RequestedAmount>5000000</RequestedAmount>
            <DesiredDeductibleAmount>150000</DesiredDeductibleAmount>
            <Tenure>24</Tenure>
            <FSPCode>FL8090</FSPCode>
            <ProductCode>17</ProductCode>
            <InterestRate>28.0</InterestRate>
            <ProcessingFee>5000</ProcessingFee>
            <Insurance>2500</Insurance>
            <PhysicalAddress>123 Main Street, Dar es Salaam</PhysicalAddress>
            <EmailAddress>john.doe@example.com</EmailAddress>
            <MobileNumber>0712345678</MobileNumber>
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
            <LoanPurpose>Education</LoanPurpose>
            <SwiftCode>TANZ1234</SwiftCode>
            <Funding>Self</Funding>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(loanOfferRequest);
    console.log('\n📥 RESPONSE XML:');

    try {
        const response2 = await axios.post('http://localhost:3002/api/loan', loanOfferRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });
        console.log(response2.data);
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        }
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // 3. LOAN_FINAL_APPROVAL_NOTIFICATION
    console.log('📋 3. LOAN_FINAL_APPROVAL_NOTIFICATION');
    console.log('-'.repeat(60));

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
    console.log('\n📥 RESPONSE XML:');

    try {
        const response3 = await axios.post('http://localhost:3002/api/loan', finalApprovalRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });
        console.log(response3.data);
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Requested message types simulation completed!');
    console.log('\n📋 SUMMARY:');
    console.log('1. LOAN_CHARGES_REQUEST → Calculates loan charges and fees');
    console.log('2. LOAN_OFFER_REQUEST → Processes loan application and sends initial approval');
    console.log('3. LOAN_FINAL_APPROVAL_NOTIFICATION → Creates client, loan, disburses funds, and sends disbursement notification');
}

simulateRequestedMessages().catch(console.error);