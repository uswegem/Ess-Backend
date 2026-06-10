const axios = require('axios');

async function simulateLoanFlow() {
    console.log('🚀 Simulating Complete Loan Flow with Client Creation\n');
    console.log('='.repeat(70) + '\n');

    const checkNumber = `CHK${Date.now()}`;
    const applicationNumber = `APP${Date.now()}`;
    const loanNumber = `LOAN${Date.now()}`;
    const fspReferenceNumber = `FSP${Date.now()}`;

    // Test 1: LOAN_CHARGES_REQUEST
    console.log('📋 TEST 1: LOAN_CHARGES_REQUEST');
    console.log('-'.repeat(50));

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
            <CheckNumber>${checkNumber}</CheckNumber>
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
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        }
        return;
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // Test 2: LOAN_INITIAL_APPROVAL_NOTIFICATION
    console.log('📋 TEST 2: LOAN_INITIAL_APPROVAL_NOTIFICATION');
    console.log('-'.repeat(50));

    const loanOfferRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>INITIAL_APPROVAL_TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_INITIAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>${applicationNumber}</ApplicationNumber>
            <CheckNumber>${checkNumber}</CheckNumber>
            <Approval>APPROVED</Approval>
            <FSPReferenceNumber>${fspReferenceNumber}</FSPReferenceNumber>
            <LoanNumber>${loanNumber}</LoanNumber>
            <ApprovedAmount>5000000</ApprovedAmount>
            <MonthlyInstallment>250000</MonthlyInstallment>
            <Tenure>24</Tenure>
            <InterestRate>20</InterestRate>
            <ProcessingFee>50000</ProcessingFee>
            <InsuranceFee>25000</InsuranceFee>
            <TotalRepaymentAmount>6000000</TotalRepaymentAmount>
            <EffectiveInterestRate>22.5</EffectiveInterestRate>
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
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        }
        return;
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // Test 3: LOAN_FINAL_APPROVAL_NOTIFICATION with Client Data
    console.log('📋 TEST 3: LOAN_FINAL_APPROVAL_NOTIFICATION');
    console.log('-'.repeat(50));

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
            <ApplicationNumber>${applicationNumber}</ApplicationNumber>
            <FSPReferenceNumber>${fspReferenceNumber}</FSPReferenceNumber>
            <LoanNumber>${loanNumber}</LoanNumber>
            <Approval>APPROVED</Approval>
            <ClientData>
                <FullName>Pelagia Ngowi</FullName>
                <DateOfBirth>1990-01-01</DateOfBirth>
                <MobileNo>255123456789</MobileNo>
                <CheckNumber>${checkNumber}</CheckNumber>
                <NIN>1234567890123456</NIN>
                <Sex>F</Sex>
                <EmploymentDate>2020-01-01</EmploymentDate>
            </ClientData>
            <AdditionalInfo>
                <Key>ApprovalDate</Key>
                <Value>${new Date().toISOString().split('T')[0]}</Value>
            </AdditionalInfo>
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
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        }
        return;
    }

    console.log('\nSimulation completed successfully! ✅');
}

// Run the simulation
simulateLoanFlow().catch(console.error);