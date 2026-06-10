const axios = require('axios');

async function simulateLoanFlow() {
    console.log('🚀 Simulating Complete Loan Flow\n');
    console.log('='.repeat(80) + '\n');

    // Generate unique identifiers for this simulation
    const timestamp = Date.now();
    const checkNumber = `CHK${timestamp}`;
    const applicationNumber = `APP${timestamp}`;
    const nin = `NIN${timestamp}`;

    console.log(`📋 Simulation Details:`);
    console.log(`   Check Number: ${checkNumber}`);
    console.log(`   Application Number: ${applicationNumber}`);
    console.log(`   NIN: ${nin}`);
    console.log('');

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
            <MsgId>CHARGES_${timestamp}</MsgId>
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
        const response1 = await axios.post('https://zedone-uat.miracore.co.tz/api/loan', loanChargesRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000,
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
        });
        console.log(response1.data);
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        }
        return; // Exit if charges request fails
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
            <MsgId>OFFER_${timestamp}</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>${checkNumber}</CheckNumber>
            <FirstName>John</FirstName>
            <MiddleName></MiddleName>
            <LastName>Doe</LastName>
            <Sex>M</Sex>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <MaritalStatus>Single</MaritalStatus>
            <BankAccountNumber>123456789</BankAccountNumber>
            <VoteCode>V001</VoteCode>
            <VoteName>Education Vote</VoteName>
            <NIN>${nin}</NIN>
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
            <PhysicalAddress>123 Main Street</PhysicalAddress>
            <TelephoneNumber>0712345678</TelephoneNumber>
            <EmailAddress>john.doe@example.com</EmailAddress>
            <MobileNumber>0712345678</MobileNumber>
            <ApplicationNumber>${applicationNumber}</ApplicationNumber>
            <LoanPurpose>Education</LoanPurpose>
            <SwiftCode>TZ123456</SwiftCode>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(loanOfferRequest);
    console.log('\n📥 RESPONSE XML:');

    let fspReferenceNumber = '';
    let loanNumber = '';

    try {
        const response2 = await axios.post('https://zedone-uat.miracore.co.tz/api/loan', loanOfferRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 60000, // Increased timeout for loan creation
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
        });
        console.log(response2.data);

        // Extract FSP reference number and loan number from response
        const responseXml = response2.data;
        const fspRefMatch = responseXml.match(/<FSPReferenceNumber>(.*?)<\/FSPReferenceNumber>/);
        const loanNumMatch = responseXml.match(/<LoanNumber>(.*?)<\/LoanNumber>/);

        if (fspRefMatch) fspReferenceNumber = fspRefMatch[1];
        if (loanNumMatch) loanNumber = loanNumMatch[1];

        console.log(`📋 Extracted FSP Reference: ${fspReferenceNumber}`);
        console.log(`📋 Extracted Loan Number: ${loanNumber}`);

    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        }
        return; // Exit if offer request fails
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
            <MsgId>FINAL_APPROVAL_${timestamp}</MsgId>
            <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>${applicationNumber}</ApplicationNumber>
            <FSPReferenceNumber>${fspReferenceNumber}</FSPReferenceNumber>
            <LoanNumber>${loanNumber}</LoanNumber>
            <Approval>APPROVED</Approval>
            <Reason>Final approval granted</Reason>
            <TotalAmountToPay>5500000.00</TotalAmountToPay>
            <OtherCharges>0.00</OtherCharges>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(finalApprovalRequest);
    console.log('\n📥 RESPONSE XML:');

    try {
        const response3 = await axios.post('https://zedone-uat.miracore.co.tz/api/loan', finalApprovalRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000,
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
        });
        console.log(response3.data);
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        }
    }

    console.log('\n' + '='.repeat(80) + '\n');
    console.log('✅ Loan flow simulation completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Check Number: ${checkNumber}`);
    console.log(`   - Application Number: ${applicationNumber}`);
    console.log(`   - NIN: ${nin}`);
    console.log(`   - FSP Reference: ${fspReferenceNumber}`);
    console.log(`   - Loan Number: ${loanNumber}`);
}

// Run the simulation
simulateLoanFlow().catch(console.error);