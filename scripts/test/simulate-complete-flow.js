const axios = require('axios');

async function simulateLoanFlow() {
    console.log('🚀 Simulating Complete Loan Flow with Updated Client\n');
    console.log('='.repeat(70) + '\n');

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
        const response1 = await axios.post('http://135.181.33.13:3002/api/loan', loanChargesRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });
        console.log(response1.data);
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        } else if (error.code) {
            console.log('Error Code:', error.code);
        } else {
            console.log('Full Error:', error);
        }
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // Test 2: LOAN_OFFER_REQUEST
    console.log('📋 TEST 2: LOAN_OFFER_REQUEST');
    console.log('-'.repeat(50));

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
    console.log(loanOfferRequest);
    console.log('\n📥 RESPONSE XML:');

    try {
        const response1 = await axios.post('http://135.181.33.13:3002/api/loan', loanOfferRequest, {
            headers: { 
                'Content-Type': 'application/xml',
                'X-ESS-Source': 'SIMULATION'
            },
            timeout: 30000
        });
        console.log(response1.data);
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        } else if (error.code) {
            console.log('Error Code:', error.code);
        } else {
            console.log('Full Error:', error);
        }
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // Test 3: LOAN_FINAL_APPROVAL_NOTIFICATION
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
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
            <FSPReferenceNumber>FSP${Date.now()}</FSPReferenceNumber>
            <LoanNumber>LOAN${Date.now()}</LoanNumber>
            <Approval>APPROVED</Approval>
            <NIN>19900615111450000123</NIN>
            <FirstName>AARON</FirstName>
            <MiddleName>JOHN</MiddleName>
            <LastName>USWEGE</LastName>
            <MobileNo>255755987654</MobileNo>
            <Sex>M</Sex>
            <DateOfBirth>1990-06-15</DateOfBirth>
            <EmploymentDate>2018-01-01</EmploymentDate>
            <MaritalStatus>MARRIED</MaritalStatus>
            <PhysicalAddress>Dar es Salaam, Tanzania</PhysicalAddress>
            <EmailAddress>aaron.uswege@example.com</EmailAddress>
            <CallbackUrl>http://135.181.33.13:3002/api/webhook/mifos</CallbackUrl>
            <BankAccountNumber>11223344556</BankAccountNumber>
            <SwiftCode>CRDBTZTZ</SwiftCode>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <RequestedAmount>8000000</RequestedAmount>
            <ProductCode>17</ProductCode>
            <Tenure>36</Tenure>
            <InterestRate>28</InterestRate>
            <ProcessingFee>160000</ProcessingFee>
            <Insurance>80000</Insurance>
            <LoanPurpose>HOME_IMPROVEMENT</LoanPurpose>
            <Funding>PERSONAL</Funding>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(finalApprovalRequest);
    console.log('\n📥 RESPONSE XML:');

    try {
        const response2 = await axios.post('http://135.181.33.13:3002/api/loan', finalApprovalRequest, {
            headers: { 
                'Content-Type': 'application/xml',
                'X-ESS-Source': 'SIMULATION'
            },
            timeout: 30000
        });
        console.log(response2.data);
        
        // Wait for client creation to complete
        console.log('\n⏳ Waiting for client creation to complete...');
        
        // Wait for client creation and CBS sync
        console.log('\n⏳ Waiting for client creation and CBS sync (30 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Check CBS directly
        try {
            const cbsResponse = await axios.get('https://zedone-uat.miracore.co.tz/fineract-provider/api/v1/clients?externalId=19900615111450000123', {
                headers: {
                    'Content-Type': 'application/json',
                    'fineract-platform-tenantid': 'zedone-uat'
                },
                auth: {
                    username: 'ess_creater',
                    password: 'Jothan@123456'
                }
            });
            } catch (error) {
                console.log('\n❌ Failed to check loan mapping:', error.message);
                try {
                    await mongoose.disconnect();
                } catch (e) {}
            }
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        } else if (error.code) {
            console.log('Error Code:', error.code);
        } else {
            console.log('Full Error:', error);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Complete loan flow simulation completed!');
    console.log('\n📋 SUMMARY:');
    console.log('1. LOAN_CHARGES_REQUEST → Calculates loan charges and fees');
    console.log('2. LOAN_OFFER_REQUEST → Processes loan application and sends initial approval');
    console.log('3. LOAN_FINAL_APPROVAL_NOTIFICATION → Creates client, loan, disburses funds, and sends disbursement notification');
}

simulateLoanFlow().catch(console.error);