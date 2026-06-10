// Test the EMI constraint fix
const axios = require('axios');

const testRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>110977381</CheckNumber>
            <DesignationCode>TZ400102</DesignationCode>
            <DesignationName>Senior Human Resource Officer I</DesignationName>
            <BasicSalary>1765000.00</BasicSalary>
            <NetSalary>1000000.00</NetSalary>
            <OneThirdAmount>588333.00</OneThirdAmount>
            <RequestedAmount>0.00</RequestedAmount>
            <DeductibleAmount>411667.00</DeductibleAmount>
            <DesiredDeductibleAmount>411667.00</DesiredDeductibleAmount>
            <RetirementDate>233</RetirementDate>
            <TermsOfEmployment>Permanent and Pensionable</TermsOfEmployment>
            <Tenure>96</Tenure>
            <ProductCode>17</ProductCode>
            <VoteCode>32</VoteCode>
            <TotalEmployeeDeduction>765000.00</TotalEmployeeDeduction>
            <JobClassCode>JBC102</JobClassCode>
        </MessageDetails>
    </Data>
    <Signature>test</Signature>
</Document>`;

async function testEMIFix() {
    try {
        console.log('🧪 Testing EMI constraint fix...');
        console.log('📤 Sending request with DesiredDeductibleAmount: 411667.00');
        
        const response = await axios.post('http://miracore:3002/api/loan', testRequest, {
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml'
            },
            timeout: 30000
        });
        
        console.log('\n📨 Response received:');
        console.log(response.data);
        
        // Parse MonthlyReturnAmount from response
        const monthlyMatch = response.data.match(/<MonthlyReturnAmount>([\d.]+)<\/MonthlyReturnAmount>/);
        const desiredMatch = response.data.match(/<DesiredDeductibleAmount>([\d.]+)<\/DesiredDeductibleAmount>/);
        
        if (monthlyMatch && desiredMatch) {
            const monthlyAmount = parseFloat(monthlyMatch[1]);
            const desiredAmount = parseFloat(desiredMatch[1]);
            
            console.log(`\n🔍 Analysis:`);
            console.log(`   MonthlyReturnAmount: ${monthlyAmount}`);
            console.log(`   DesiredDeductibleAmount: ${desiredAmount}`);
            
            if (monthlyAmount <= desiredAmount) {
                console.log('✅ SUCCESS: MonthlyReturnAmount ≤ DesiredDeductibleAmount');
            } else {
                console.log('❌ FAILED: MonthlyReturnAmount > DesiredDeductibleAmount');
                console.log(`   Difference: ${(monthlyAmount - desiredAmount).toFixed(2)}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

testEMIFix();