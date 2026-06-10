const axios = require('axios');

// Create a loan charges request similar to the one we saw in logs
const testLoanChargesRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_RESPONSE_CAPTURE_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>110507354</CheckNumber>
            <DesignationCode>TZ400184</DesignationCode>
            <DesignationName>Senior Legal Officer I</DesignationName>
            <BasicSalary>2068000.00</BasicSalary>
            <NetSalary>1500000.00</NetSalary>
            <OneThirdAmount>689333.00</OneThirdAmount>
            <RequestedAmount>43768847.90</RequestedAmount>
            <DeductibleAmount>810667.00</DeductibleAmount>
            <DesiredDeductibleAmount>0.00</DesiredDeductibleAmount>
            <RetirementDate>249</RetirementDate>
            <TermsOfEmployment>Permanent and Pensionable</TermsOfEmployment>
            <Tenure>0</Tenure>
            <ProductCode>17</ProductCode>
            <VoteCode>32</VoteCode>
            <TotalEmployeeDeduction>568000.00</TotalEmployeeDeduction>
            <JobClassCode>JBC184</JobClassCode>
        </MessageDetails>
    </Data>
    <Signature>MockSignatureForTesting</Signature>
</Document>`;

async function sendTestRequest() {
    console.log('📤 Sending test request to capture response XML...\n');
    
    try {
        const response = await axios.post('http://135.181.33.13:3002/api/loan', testLoanChargesRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });
        
        console.log('✅ Response received!');
        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers['content-type']);
        console.log('\n📥 RESPONSE XML:');
        console.log(response.data);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        }
    }
}

sendTestRequest();