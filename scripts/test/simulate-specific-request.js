const axios = require('axios');

async function simulateSpecificRequest() {
    console.log('🚀 Simulating Specific LOAN_CHARGES_REQUEST\n');
    console.log('='.repeat(80) + '\n');

    // Parameters from your request
    console.log('📋 Request Parameters:');
    console.log('   DesiredDeductibleAmount: 411,667 TZS');
    console.log('   DeductibleAmount: 411,667 TZS');
    console.log('   OneThirdAmount: 588,333 TZS');
    console.log('   RequestedAmount: 0 (system calculates max loan)');
    console.log('   Expected Max Loan: ~22,939,967 TZS');
    console.log('   Expected Monthly EMI: 411,667 TZS\n');

    const loanChargesRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>CHARGES_SPECIFIC_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <DesignationCode>D001</DesignationCode>
            <DesignationName>Senior Teacher</DesignationName>
            <BasicSalary>1765000</BasicSalary>
            <NetSalary>1765000</NetSalary>
            <OneThirdAmount>588333</OneThirdAmount>
            <DeductibleAmount>411667</DeductibleAmount>
            <RetirementDate>2050-01-01</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
            <RequestedAmount>0</RequestedAmount>
            <DesiredDeductibleAmount>411667</DesiredDeductibleAmount>
            <Tenure>60</Tenure>
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
        const response = await axios.post('http://localhost:3002/api/loan', loanChargesRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });
        
        // Pretty print the response
        const responseXml = response.data;
        console.log(responseXml);
        
        // Extract key values from response
        console.log('\n📊 EXTRACTED RESPONSE VALUES:');
        console.log('-'.repeat(60));
        
        const extractValue = (xml, tag) => {
            const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
            return match ? match[1] : 'Not found';
        };
        
        console.log(`🔹 DesiredDeductibleAmount: ${extractValue(responseXml, 'DesiredDeductibleAmount')} TZS`);
        console.log(`🔹 MonthlyReturnAmount: ${extractValue(responseXml, 'MonthlyReturnAmount')} TZS`);
        console.log(`🔹 EligibleAmount: ${extractValue(responseXml, 'EligibleAmount')} TZS`);
        console.log(`🔹 TotalAmountToPay: ${extractValue(responseXml, 'TotalAmountToPay')} TZS`);
        console.log(`🔹 NetLoanAmount: ${extractValue(responseXml, 'NetLoanAmount')} TZS`);
        console.log(`🔹 Tenure: ${extractValue(responseXml, 'Tenure')} months`);
        console.log(`🔹 TotalProcessingFees: ${extractValue(responseXml, 'TotalProcessingFees')} TZS`);
        console.log(`🔹 TotalInsurance: ${extractValue(responseXml, 'TotalInsurance')} TZS`);
        console.log(`🔹 TotalInterestRateAmount: ${extractValue(responseXml, 'TotalInterestRateAmount')} TZS`);
        console.log(`🔹 OtherCharges: ${extractValue(responseXml, 'OtherCharges')} TZS`);
        
    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        }
    }

    console.log('\n' + '='.repeat(80));
}

simulateSpecificRequest().catch(console.error);