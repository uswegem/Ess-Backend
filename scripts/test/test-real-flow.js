const axios = require('axios');
const xml2js = require('xml2js');

const SERVER_URL = 'http://135.181.33.13:3002/api/loan';

// Generate unique identifiers for the entire simulation session
const timestamp = Date.now();
const applicationNumber = `APP${timestamp}`;
const checkNumber = `CHK${timestamp}`;

console.log('🚀 Testing Real Loan Flow with Server\n');
console.log('='.repeat(70));
console.log(`📋 Application Number: ${applicationNumber}`);
console.log(`📋 Check Number: ${checkNumber}`);
console.log('='.repeat(70) + '\n');

async function testCompleteFlow() {
    try {
        // Step 1: LOAN_CHARGES_REQUEST
        console.log('📋 STEP 1: LOAN_CHARGES_REQUEST');
        console.log('-'.repeat(50));
        
        const chargesRequest = `<?xml version="1.0" encoding="UTF-8"?>
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

        console.log('📤 Sending LOAN_CHARGES_REQUEST...');
        const chargesResponse = await axios.post(SERVER_URL, chargesRequest, {
            headers: { 'Content-Type': 'application/xml' }
        });
        console.log('✅ Response received:', chargesResponse.status);
        console.log('📥 Response data:', chargesResponse.data.substring(0, 500) + '...\n');

        // Wait a bit before next request
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: LOAN_OFFER_REQUEST
        console.log('📋 STEP 2: LOAN_OFFER_REQUEST (Store Client Data)');
        console.log('-'.repeat(50));
        
        const offerRequest = `<?xml version="1.0" encoding="UTF-8"?>
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
            <CheckNumber>${checkNumber}</CheckNumber>
            <FirstName>Pelagia</FirstName>
            <MiddleName></MiddleName>
            <LastName>Ngowi</LastName>
            <Sex>F</Sex>
            <BankAccountNumber>1234567890</BankAccountNumber>
            <EmploymentDate>2015-01-01</EmploymentDate>
            <MaritalStatus>Single</MaritalStatus>
            <ConfirmationDate>2015-06-01</ConfirmationDate>
            <TotalEmployeeDeduction>100000</TotalEmployeeDeduction>
            <NearestBranchName>Dar es Salaam Branch</NearestBranchName>
            <NearestBranchCode>DSM001</NearestBranchCode>
            <VoteCode>V001</VoteCode>
            <VoteName>Education Vote</VoteName>
            <NIN>19900101123456789012</NIN>
            <DesignationCode>D001</DesignationCode>
            <DesignationName>Teacher</DesignationName>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1400000</NetSalary>
            <OneThirdAmount>500000</OneThirdAmount>
            <RequestedAmount>5000000</RequestedAmount>
            <DesiredDeductibleAmount>150000</DesiredDeductibleAmount>
            <RetirementDate>2050-01-01</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
            <Tenure>24</Tenure>
            <ProductCode>17</ProductCode>
            <InterestRate>24</InterestRate>
            <ProcessingFee>2</ProcessingFee>
            <Insurance>1.5</Insurance>
            <PhysicalAddress>Kinondoni, Dar es Salaam</PhysicalAddress>
            <EmailAddress>pelagia.ngowi@example.com</EmailAddress>
            <MobileNumber>255712345678</MobileNumber>
            <ApplicationNumber>${applicationNumber}</ApplicationNumber>
            <LoanPurpose>Personal Development</LoanPurpose>
            <ContractStartDate>2015-01-01</ContractStartDate>
            <ContractEndDate>2050-12-31</ContractEndDate>
            <SwiftCode>CRDBTZTZ</SwiftCode>
            <Funding>Government</Funding>
        </MessageDetails>
    </Data>
</Document>`;

        console.log('📤 Sending LOAN_OFFER_REQUEST with Pelagia Ngowi details...');
        const offerResponse = await axios.post(SERVER_URL, offerRequest, {
            headers: { 'Content-Type': 'application/xml' }
        });
        console.log('✅ Response received:', offerResponse.status);
        console.log('📥 Response data:', offerResponse.data.substring(0, 500) + '...\n');
        console.log('💾 Client data stored in database for:', applicationNumber);

        // Wait a bit before final approval
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 3: LOAN_FINAL_APPROVAL_NOTIFICATION
        console.log('📋 STEP 3: LOAN_FINAL_APPROVAL_NOTIFICATION (Create Client in CBS)');
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
            <Reason>N</Reason>
            <FSPReferenceNumber>FSP${timestamp}</FSPReferenceNumber>
            <LoanNumber>LOAN${timestamp}</LoanNumber>
            <Approval>APPROVED</Approval>
        </MessageDetails>
    </Data>
</Document>`;

        console.log('📤 Sending LOAN_FINAL_APPROVAL_NOTIFICATION...');
        console.log(`🔍 Using Application Number: ${applicationNumber}`);
        const finalResponse = await axios.post(SERVER_URL, finalApprovalRequest, {
            headers: { 'Content-Type': 'application/xml' }
        });
        console.log('✅ Response received:', finalResponse.status);
        console.log('📥 Response data:', finalResponse.data.substring(0, 500) + '...\n');

        // Wait for async processing
        console.log('⏳ Waiting for async client creation in CBS...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('\n' + '='.repeat(70));
        console.log('✅ COMPLETE FLOW EXECUTED SUCCESSFULLY!');
        console.log('='.repeat(70));
        console.log('\n📋 SUMMARY:');
        console.log(`   Application Number: ${applicationNumber}`);
        console.log(`   Check Number: ${checkNumber}`);
        console.log(`   Client Name: Pelagia Ngowi`);
        console.log(`   Status: Client should be created in CBS`);
        console.log('\n💡 Check server logs for client creation details');
        console.log('💡 Check MongoDB loan_mappings collection for stored data');

    } catch (error) {
        console.error('\n❌ Error during flow execution:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run the test
testCompleteFlow();
