const axios = require('axios');

async function testSimple() {
    console.log('🧪 Testing simple LOAN_CHARGES_REQUEST\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_SIMPLE_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK123</CheckNumber>
            <DesignationCode>TZ4000718</DesignationCode>
            <DesignationName>Senior Officer</DesignationName>
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
        </MessageDetails>
    </Data>
</Document>`;

    try {
        console.log('📤 Sending LOAN_CHARGES_REQUEST...');
        const response = await axios.post('http://135.181.33.13:3002/api/loan', xml, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });

        console.log('✅ SUCCESS! Status:', response.status);
        console.log('Response preview:', response.data.substring(0, 200) + '...');
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testSimple();
