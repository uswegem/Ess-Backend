const axios = require('axios');

async function testRestructureAffordability() {
    console.log('🧪 Testing LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_RESTR_${Date.now()}</MsgId>
            <MessageType>LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Math.floor(Math.random() * 1000000)}</CheckNumber>
            <DesignationCode>TZ4000718</DesignationCode>
            <DesignationName>Senior Records Management Assistant I</DesignationName>
            <BasicSalary>2500000</BasicSalary>
            <NetSalary>1800000</NetSalary>
            <OneThirdAmount>833333</OneThirdAmount>
            <RequestedAmount>5000000</RequestedAmount>
            <DeductibleAmount>600000</DeductibleAmount>
            <DesiredDeductibleAmount>500000</DesiredDeductibleAmount>
            <RetirementDate>240</RetirementDate>
            <TermsOfEmployment>Permanent</TermsOfEmployment>
            <Tenure>36</Tenure>
            <ProductCode>17</ProductCode>
            <VoteCode>V001</VoteCode>
            <TotalEmployeeDeduction>200000</TotalEmployeeDeduction>
            <JobClassCode>JC001</JobClassCode>
            <LoanNumber>LOAN${Date.now()}</LoanNumber>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        console.log('📤 Sending request to http://135.181.33.13:3002/api/loan');
        console.log('   Message Type: LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST');
        console.log('   Requested Amount: 5,000,000 TZS');
        console.log('   Tenure: 36 months\n');

        const response = await axios.post('http://135.181.33.13:3002/api/loan', xml, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });

        console.log('✅ SUCCESS!');
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers['content-type']}\n`);

        console.log('📄 Raw Response:');
        console.log(response.data);
        console.log('\n');

        // Parse response
        const xml2js = require('xml2js');
        const parser = new xml2js.Parser({ explicitArray: false });
        const parsed = await parser.parseStringPromise(response.data);
        
        const messageType = parsed?.Document?.Data?.Header?.MessageType;
        const messageDetails = parsed?.Document?.Data?.MessageDetails;

        if (messageType === 'LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE') {
            console.log('📊 Response Details:');
            console.log(`   Message Type: ${messageType}`);
            console.log(`   Eligible Amount: ${messageDetails.EligibleAmount} TZS`);
            console.log(`   Monthly Return: ${messageDetails.MonthlyReturnAmount} TZS`);
            console.log(`   Net Loan Amount: ${messageDetails.NetLoanAmount} TZS`);
            console.log(`   Total Interest: ${messageDetails.TotalInterestRateAmount} TZS`);
            console.log(`   Total to Pay: ${messageDetails.TotalAmountToPay} TZS`);
            console.log(`   Tenure: ${messageDetails.Tenure} months\n`);
            console.log('✅ LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST is working correctly!');
        } else if (messageDetails?.ResponseCode) {
            console.log('❌ Error Response:');
            console.log(`   Code: ${messageDetails.ResponseCode}`);
            console.log(`   Description: ${messageDetails.Description}`);
        } else {
            console.log('⚠️ Unexpected response format');
            console.log(JSON.stringify(parsed, null, 2));
        }

    } catch (error) {
        console.error('❌ FAILED!');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data:`, error.response.data);
        } else {
            console.error(`   Error: ${error.message}`);
        }
        process.exit(1);
    }
}

testRestructureAffordability();
