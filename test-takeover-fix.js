const axios = require('axios');
const xml2js = require('xml2js');

const API_URL = 'http://135.181.33.13:3002/api/ess';

async function testTakeoverWithoutRequestedAmount() {
    console.log('🧪 Testing LOAN_TAKEOVER_OFFER_REQUEST without RequestedTakeoverAmount\n');
    console.log('='.repeat(80) + '\n');

    const timestamp = Date.now();
    const checkNumber = `TEST${timestamp}`;
    const applicationNumber = `ESSTEST${timestamp}`;

    // Test Case 1: No RequestedTakeoverAmount, but has TakeOverAmount
    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_TAKEOVER_${timestamp}</MsgId>
            <MessageType>LOAN_TAKEOVER_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>${checkNumber}</CheckNumber>
            <FirstName>Test</FirstName>
            <MiddleName>User</MiddleName>
            <LastName>Takeover</LastName>
            <Sex>M</Sex>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <MaritalStatus>Single</MaritalStatus>
            <BankAccountNumber>123456789</BankAccountNumber>
            <VoteCode>32</VoteCode>
            <VoteName>Test Vote</VoteName>
            <NIN>19900101123450000111</NIN>
            <DesignationCode>TZ800186</DesignationCode>
            <DesignationName>Test Officer</DesignationName>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1200000</NetSalary>
            <OneThirdAmount>400000</OneThirdAmount>
            <TotalEmployeeDeduction>300000</TotalEmployeeDeduction>
            <RetirementDate>120</RetirementDate>
            <TermsOfEmployment>Permanent and Pensionable</TermsOfEmployment>
            <Tenure>24</Tenure>
            <ProductCode>17</ProductCode>
            <InterestRate>28.0</InterestRate>
            <ProcessingFee>2.0</ProcessingFee>
            <Insurance>1.5</Insurance>
            <PhysicalAddress>Test Address</PhysicalAddress>
            <EmailAddress>test@example.com</EmailAddress>
            <MobileNumber>0700000000</MobileNumber>
            <ApplicationNumber>${applicationNumber}</ApplicationNumber>
            <LoanPurpose>Test Takeover</LoanPurpose>
            <SwiftCode>TESTBANK</SwiftCode>
            <Funding>GF</Funding>
            <FSP1Code>FL9999</FSP1Code>
            <FSP1LoanNumber>OLD_LOAN_123</FSP1LoanNumber>
            <FSP1BankAccount>999888777</FSP1BankAccount>
            <FSP1BankAccountName>OLD FSP ACCOUNT</FSP1BankAccountName>
            <FSP1SWIFTCode>OLDBANK</FSP1SWIFTCode>
            <TakeOverAmount>2500000.00</TakeOverAmount>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 Test Case 1: No RequestedTakeoverAmount, TakeOverAmount = 2,500,000');
    console.log('Expected: Should use TakeOverAmount for calculations\n');

    try {
        const response = await axios.post(API_URL, xmlRequest, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 30000
        });

        console.log('✅ Response Status:', response.status);
        console.log('📥 Response Data:');
        
        // Parse XML response
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        console.log(JSON.stringify(result, null, 2));

        // Wait for delayed callback (10 seconds)
        console.log('\n⏳ Waiting 15 seconds for delayed LOAN_INITIAL_APPROVAL_NOTIFICATION...\n');
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Check loan mapping in database
        console.log('🔍 Checking loan mapping in database...\n');
        const checkResponse = await axios.get(`http://135.181.33.13:3002/api/frontend/loan/records?applicationNumber=${applicationNumber}`);
        
        if (checkResponse.data.success && checkResponse.data.data.length > 0) {
            const loan = checkResponse.data.data[0];
            console.log('✅ Loan Record Found:');
            console.log('   Application Number:', loan.applicationNumber);
            console.log('   Amount:', loan.amount);
            console.log('   Status:', loan.status);
            console.log('   Product Code:', loan.productCode);
            console.log('   Tenure:', loan.tenure);
            
            if (loan.amount > 0) {
                console.log('\n✅ TEST PASSED: Amount was populated from TakeOverAmount');
            } else {
                console.log('\n❌ TEST FAILED: Amount is still 0');
            }
        } else {
            console.log('⚠️  No loan record found yet');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Test Case 2: Both RequestedTakeoverAmount and TakeOverAmount provided
    console.log('📤 Test Case 2: Both RequestedTakeoverAmount (3M) and TakeOverAmount (2.5M)');
    console.log('Expected: Should use RequestedTakeoverAmount (3M)\n');

    const timestamp2 = Date.now() + 1000;
    const checkNumber2 = `TEST${timestamp2}`;
    const applicationNumber2 = `ESSTEST${timestamp2}`;

    const xmlRequest2 = xmlRequest
        .replace(checkNumber, checkNumber2)
        .replace(applicationNumber, applicationNumber2)
        .replace('TEST_TAKEOVER_' + timestamp, 'TEST_TAKEOVER_' + timestamp2)
        .replace('<TakeOverAmount>2500000.00</TakeOverAmount>', 
                 '<RequestedTakeoverAmount>3000000.00</RequestedTakeoverAmount>\n            <TakeOverAmount>2500000.00</TakeOverAmount>');

    try {
        const response = await axios.post(API_URL, xmlRequest2, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 30000
        });

        console.log('✅ Response Status:', response.status);
        
        await new Promise(resolve => setTimeout(resolve, 15000));

        const checkResponse = await axios.get(`http://135.181.33.13:3002/api/frontend/loan/records?applicationNumber=${applicationNumber2}`);
        
        if (checkResponse.data.success && checkResponse.data.data.length > 0) {
            const loan = checkResponse.data.data[0];
            console.log('✅ Loan Record Found:');
            console.log('   Amount:', loan.amount);
            
            if (loan.amount === 3000000) {
                console.log('\n✅ TEST PASSED: Used RequestedTakeoverAmount (priority)');
            } else if (loan.amount === 2500000) {
                console.log('\n⚠️  Used TakeOverAmount instead of RequestedTakeoverAmount');
            } else {
                console.log('\n❌ TEST FAILED: Unexpected amount value');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('\n✅ Test completed!\n');
}

// Run the test
testTakeoverWithoutRequestedAmount().catch(console.error);
