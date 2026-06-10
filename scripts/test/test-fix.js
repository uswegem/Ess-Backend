const axios = require('axios');

async function testLoanChargesFix() {
    console.log('🧪 Testing LOAN_CHARGES_REQUEST fix...');
    
    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_FIX_001</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>11139834</CheckNumber>
            <DesignationCode>TZ4000718</DesignationCode>
            <DesignationName>Senior Records Management Assistant I</DesignationName>
            <BasicSalary>1000000.00</BasicSalary>
            <NetSalary>600000.00</NetSalary>
            <OneThirdAmount>333333.00</OneThirdAmount>
            <RequestedAmount>0.00</RequestedAmount>
            <DeductibleAmount>266667.00</DeductibleAmount>
            <DesiredDeductibleAmount>266667.00</DesiredDeductibleAmount>
            <RetirementDate>240</RetirementDate>
            <TermsOfEmployment>CONTRUCT</TermsOfEmployment>
            <Tenure>96</Tenure>
            <ProductCode>17</ProductCode>
            <VoteCode>32</VoteCode>
            <TotalEmployeeDeduction>400000.00</TotalEmployeeDeduction>
            <JobClassCode>JBCA718</JobClassCode>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const response = await axios.post('http://localhost:3002/api/loan', xmlRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 10000
        });
        
        console.log('✅ SUCCESS! Status:', response.status);
        console.log('Response preview:', response.data.substring(0, 200) + '...');
        
        // Check if response contains expected fields
        if (response.data.includes('TotalInterestRateAmount') && response.data.includes('EligibleAmount')) {
            console.log('✅ Response contains expected loan calculation fields!');
        } else {
            console.log('⚠️ Response may be missing expected fields');
        }
        
    } catch (error) {
        console.log('❌ FAILED:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        }
    }
}

testLoanChargesFix();