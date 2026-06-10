const axios = require('axios');

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING AUTO TOP-UP DETECTION');
console.log('='.repeat(80) + '\n');

// Test with the NIN that has an active loan (client 56 with loan 28)
const testNIN = '19711126114060000121';

async function testAutoTopUpDetection() {
    try {
        console.log('📋 Test Case: LOAN_OFFER_REQUEST with NIN that has active loan');
        console.log(`   NIN: ${testNIN}`);
        console.log(`   Expected: Should be auto-detected as TOP-UP\n`);

        const loanOfferXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
  <Data>
    <Header>
      <Sender>ESS_UTUMISHI</Sender>
      <Receiver>ZE DONE</Receiver>
      <FSPCode>FL8090</FSPCode>
      <MsgId>TEST_${Date.now()}</MsgId>
      <MessageType>LOAN_OFFER_REQUEST</MessageType>
      <FSPReferenceNumber>TEST_REF_${Date.now()}</FSPReferenceNumber>
    </Header>
    <MessageDetails>
      <ApplicationNumber>ESS_TEST_${Date.now()}</ApplicationNumber>
      <CheckNumber>CHECK_TEST_${Date.now()}</CheckNumber>
      <FirstName>Akley</FirstName>
      <MiddleName>Joseph</MiddleName>
      <LastName>Ntondo</LastName>
      <Sex>M</Sex>
      <NIN>${testNIN}</NIN>
      <DateOfBirth>1971-11-26</DateOfBirth>
      <MaritalStatus>MARRIED</MaritalStatus>
      <BankAccountNumber>1234567890</BankAccountNumber>
      <SwiftCode>CRDBTZTZ</SwiftCode>
      <PhysicalAddress>Dar es Salaam</PhysicalAddress>
      <EmailAddress>akley.ntondo@test.com</EmailAddress>
      <MobileNumber>255712345678</MobileNumber>
      <RequestedAmount>2000000</RequestedAmount>
      <DesiredDeductibleAmount>100000</DesiredDeductibleAmount>
      <Tenure>24</Tenure>
      <ProductCode>17</ProductCode>
      <DesignationCode>TEACHER</DesignationCode>
      <DesignationName>Teacher Grade A</DesignationName>
      <BasicSalary>800000</BasicSalary>
      <NetSalary>650000</NetSalary>
      <OneThirdAmount>216666</OneThirdAmount>
      <DeductibleAmount>200000</DeductibleAmount>
      <TotalEmployeeDeduction>150000</TotalEmployeeDeduction>
      <RetirementDate>2036-11-26</RetirementDate>
      <TermsOfEmployment>PERMANENT</TermsOfEmployment>
      <VoteCode>VOTE123</VoteCode>
      <VoteName>Education Department</VoteName>
      <NearestBranchName>Ilala Branch</NearestBranchName>
      <NearestBranchCode>001</NearestBranchCode>
      <EmploymentDate>2010-01-15</EmploymentDate>
      <ConfirmationDate>2012-01-15</ConfirmationDate>
    </MessageDetails>
  </Data>
  <Signature>TEST_SIGNATURE</Signature>
</Document>`;

        console.log('📤 Sending LOAN_OFFER_REQUEST to API...\n');

        const response = await axios.post('http://localhost:3002/api/loan', loanOfferXML, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 30000
        });

        console.log('✅ Response received:');
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Response:\n${response.data}\n`);

        console.log('⏳ Waiting 25 seconds for LOAN_INITIAL_APPROVAL_NOTIFICATION callback...\n');
        await new Promise(resolve => setTimeout(resolve, 25000));

        console.log('='.repeat(80));
        console.log('📝 CHECK LOGS FOR:');
        console.log('='.repeat(80));
        console.log('✓ "🔍 Checking for active loans for NIN:"');
        console.log('✓ "⚠️ Active loan(s) detected:"');
        console.log('✓ "🔄 Customer has active loan - automatically treating as TOP-UP request"');
        console.log('✓ "📊 Processing automatic TOP-UP with active loan:"');
        console.log('✓ "✅ Sent LOAN_INITIAL_APPROVAL_NOTIFICATION for auto-detected top-up"');
        console.log('✓ Reason should contain: "Top-Up Loan Approved (Auto-detected existing loan)"');
        console.log('='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
    }
}

// Run locally (will need to SSH to remote server for actual test)
console.log('⚠️  NOTE: This test should be run on the remote server');
console.log('📌 Command: ssh uswege@135.181.33.13 "cd /home/uswege/ess && node test-auto-topup.js"');
console.log('');

// Uncomment to run
// testAutoTopUpDetection();
