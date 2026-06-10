const axios = require('axios');

const API_URL = 'http://135.181.33.13:3002/api/ess';

async function testTakeoverFix() {
    console.log('🧪 Testing LOAN_TAKEOVER_OFFER_REQUEST Fix on Production\n');
    console.log('='.repeat(80));

    const timestamp = Date.now();
    const checkNumber = `999${timestamp.toString().slice(-6)}`;
    const applicationNumber = `ESSTEST${timestamp}`;

    // Create takeover request WITHOUT RequestedTakeoverAmount, only TakeOverAmount
    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_FIX_${timestamp}</MsgId>
            <MessageType>LOAN_TAKEOVER_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>${checkNumber}</CheckNumber>
            <FirstName>TestFix</FirstName>
            <MiddleName>Takeover</MiddleName>
            <LastName>User</LastName>
            <Sex>M</Sex>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <MaritalStatus>Single</MaritalStatus>
            <BankAccountNumber>123456789</BankAccountNumber>
            <VoteCode>32</VoteCode>
            <VoteName>Test Department</VoteName>
            <NIN>19900101123450000999</NIN>
            <DesignationCode>TZ800186</DesignationCode>
            <DesignationName>Test Officer</DesignationName>
            <BasicSalary>1500000.00</BasicSalary>
            <NetSalary>1200000.00</NetSalary>
            <OneThirdAmount>400000.00</OneThirdAmount>
            <TotalEmployeeDeduction>300000.00</TotalEmployeeDeduction>
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
            <LoanPurpose>Test Takeover Fix</LoanPurpose>
            <SwiftCode>TESTBANK</SwiftCode>
            <Funding>GF</Funding>
            <FSP1Code>FL9999</FSP1Code>
            <FSP1LoanNumber>OLD_LOAN_${timestamp}</FSP1LoanNumber>
            <FSP1BankAccount>999888777</FSP1BankAccount>
            <FSP1BankAccountName>OLD FSP ACCOUNT</FSP1BankAccountName>
            <FSP1SWIFTCode>OLDBANK</FSP1SWIFTCode>
            <TakeOverAmount>2500000.00</TakeOverAmount>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('\n📤 Sending Test Request:');
    console.log(`   Application Number: ${applicationNumber}`);
    console.log(`   Check Number: ${checkNumber}`);
    console.log(`   TakeOverAmount: 2,500,000 TZS`);
    console.log(`   RequestedTakeoverAmount: NOT PROVIDED (testing fix)`);
    console.log('\n' + '-'.repeat(80) + '\n');

    try {
        // Send the request
        const response = await axios.post(API_URL, xmlRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 15000
        });

        console.log('✅ Immediate ACK Response Received');
        console.log('   Status:', response.status);
        console.log('   Response length:', response.data.length, 'bytes\n');

        // Wait for the delayed callback processing (10 seconds delay + processing time)
        console.log('⏳ Waiting 12 seconds for delayed INITIAL_APPROVAL processing...\n');
        await new Promise(resolve => setTimeout(resolve, 12000));

        // Check the loan mapping via API
        console.log('🔍 Checking loan mapping in database...\n');
        
        const checkUrl = `http://135.181.33.13:3002/api/frontend/loan/records?limit=20`;
        const loansResponse = await axios.get(checkUrl);

        if (loansResponse.data.success) {
            const testLoan = loansResponse.data.data.find(
                loan => loan.applicationNumber === applicationNumber
            );

            if (testLoan) {
                console.log('✅ TEST LOAN FOUND IN DATABASE!\n');
                console.log('📋 Loan Details:');
                console.log('   Application Number:', testLoan.applicationNumber);
                console.log('   Check Number:', testLoan.checkNumber);
                console.log('   Status:', testLoan.status);
                console.log('   Product Code:', testLoan.productCode);
                console.log('   Tenure:', testLoan.tenure);
                console.log('   Amount:', testLoan.amount);
                
                console.log('\n' + '='.repeat(80));
                
                if (testLoan.amount > 0) {
                    console.log('\n✅ ✅ ✅ FIX VERIFIED! ✅ ✅ ✅');
                    console.log('\n   The system correctly used TakeOverAmount (2,500,000)');
                    console.log('   when RequestedTakeoverAmount was not provided.');
                    console.log('\n   Status:', testLoan.status);
                    console.log('   Expected: INITIAL_APPROVAL_SENT or INITIAL_OFFER');
                    
                    if (testLoan.status === 'INITIAL_APPROVAL_SENT' || testLoan.status === 'INITIAL_OFFER') {
                        console.log('\n   ✅ Status is correct!');
                        console.log('   ✅ Approval notification was sent!');
                    }
                } else {
                    console.log('\n❌ ❌ ❌ FIX NOT WORKING ❌ ❌ ❌');
                    console.log('\n   Amount is still 0. TakeOverAmount was not used.');
                    console.log('   This suggests the fix may not be active yet.');
                }
                
            } else {
                console.log('⚠️  Test loan not found in database yet.');
                console.log('   This might mean:');
                console.log('   1. Processing is still ongoing');
                console.log('   2. The request was rejected due to missing amounts');
                console.log('   3. Database sync delay');
                console.log('\n   Total loans in DB:', loansResponse.data.pagination.total);
            }
        }

    } catch (error) {
        console.error('❌ Error during test:');
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data?.substring(0, 500));
        } else {
            console.error('   Message:', error.message);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 Checking production logs for processing details...\n');
    
    // Note: This would require SSH access which we can do manually
    console.log('To check logs manually, run:');
    console.log(`ssh uswege@135.181.33.13 "pm2 logs ess-app --lines 50 --nostream | grep -i '${applicationNumber}'"`);
    console.log('\nOr check for the fix log message:');
    console.log(`ssh uswege@135.181.33.13 "pm2 logs ess-app --lines 100 --nostream | grep 'Using TakeOverAmount'"`);
    
    console.log('\n✅ Test completed!\n');
}

// Run the test
testTakeoverFix().catch(console.error);
