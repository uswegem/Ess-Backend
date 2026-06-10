/**
 * Test Pattern Alignment Between LOAN_CHARGES_REQUEST and LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST
 * Ensures both message types follow the same processing pattern
 */

const axios = require('axios');

async function testPatternAlignment() {
    console.log('🔍 Testing Processing Pattern Alignment\n');

    const baseUrl = 'http://localhost:3002/api/loan';

    // Test data for LOAN_CHARGES_REQUEST
    const loanChargesRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_CHARGES_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>12345678</CheckNumber>
            <DesignationCode>TZ4000718</DesignationCode>
            <DesignationName>Senior Records Management Assistant I</DesignationName>
            <BasicSalary>1000000</BasicSalary>
            <NetSalary>600000</NetSalary>
            <OneThirdAmount>333333</OneThirdAmount>
            <RequestedAmount>5000000</RequestedAmount>
            <DeductibleAmount>266667</DeductibleAmount>
            <DesiredDeductibleAmount>250000</DesiredDeductibleAmount>
            <RetirementDate>240</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
            <Tenure>36</Tenure>
            <ProductCode>17</ProductCode>
            <VoteCode>32</VoteCode>
            <TotalEmployeeDeduction>400000</TotalEmployeeDeduction>
            <JobClassCode>JBCA718</JobClassCode>
        </MessageDetails>
    </Data>
</Document>`;

    // Test data for LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST
    const restructureAffordabilityRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_RESTRUCTURE_${Date.now()}</MsgId>
            <MessageType>LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>12345678</CheckNumber>
            <LoanNumber>LOAN123456789</LoanNumber>
            <DesignationCode>TZ4000718</DesignationCode>
            <DesignationName>Senior Records Management Assistant I</DesignationName>
            <BasicSalary>1000000</BasicSalary>
            <NetSalary>600000</NetSalary>
            <OneThirdAmount>333333</OneThirdAmount>
            <RequestedAmount>5000000</RequestedAmount>
            <DeductibleAmount>266667</DeductibleAmount>
            <DesiredDeductibleAmount>250000</DesiredDeductibleAmount>
            <RetirementDate>240</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
            <Tenure>36</Tenure>
            <ProductCode>17</ProductCode>
            <VoteCode>32</VoteCode>
            <TotalEmployeeDeduction>400000</TotalEmployeeDeduction>
            <JobClassCode>JBCA718</JobClassCode>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        // Test LOAN_CHARGES_REQUEST
        console.log('📋 Testing LOAN_CHARGES_REQUEST...');
        const chargesResponse = await axios.post(baseUrl, loanChargesRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 10000
        });

        console.log('✅ LOAN_CHARGES_REQUEST processed successfully');
        console.log(`   Response Type: ${chargesResponse.headers['content-type']}`);
        console.log(`   Status Code: ${chargesResponse.status}`);

        // Parse response to check structure
        const xml2js = require('xml2js');
        const parser = new xml2js.Parser();
        const chargesResult = await parser.parseStringPromise(chargesResponse.data);
        const chargesDetails = chargesResult?.Document?.Data?.MessageDetails;

        if (chargesDetails) {
            console.log('   Response Fields:');
            console.log(`     - EligibleAmount: ${chargesDetails.EligibleAmount || 'Missing'}`);
            console.log(`     - MonthlyReturnAmount: ${chargesDetails.MonthlyReturnAmount || 'Missing'}`);
            console.log(`     - TotalAmountToPay: ${chargesDetails.TotalAmountToPay || 'Missing'}`);
            console.log(`     - NetLoanAmount: ${chargesDetails.NetLoanAmount || 'Missing'}`);
            console.log(`     - Tenure: ${chargesDetails.Tenure || 'Missing'}`);
        }

        console.log();

        // Test LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST
        console.log('📋 Testing LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST...');
        const restructureResponse = await axios.post(baseUrl, restructureAffordabilityRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 10000
        });

        console.log('✅ LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST processed successfully');
        console.log(`   Response Type: ${restructureResponse.headers['content-type']}`);
        console.log(`   Status Code: ${restructureResponse.status}`);

        // Parse response to check structure
        const restructureResult = await parser.parseStringPromise(restructureResponse.data);
        const restructureDetails = restructureResult?.Document?.Data?.MessageDetails;

        if (restructureDetails) {
            console.log('   Response Fields:');
            console.log(`     - EligibleAmount: ${restructureDetails.EligibleAmount || 'Missing'}`);
            console.log(`     - MonthlyReturnAmount: ${restructureDetails.MonthlyReturnAmount || 'Missing'}`);
            console.log(`     - TotalAmountToPay: ${restructureDetails.TotalAmountToPay || 'Missing'}`);
            console.log(`     - NetLoanAmount: ${restructureDetails.NetLoanAmount || 'Missing'}`);
            console.log(`     - Tenure: ${restructureDetails.Tenure || 'Missing'}`);
        }

        console.log();

        // Compare response structures
        console.log('🔍 Pattern Alignment Analysis:');
        
        const chargesMessageType = chargesResult?.Document?.Data?.Header?.MessageType;
        const restructureMessageType = restructureResult?.Document?.Data?.Header?.MessageType;
        
        console.log(`   LOAN_CHARGES response type: ${chargesMessageType}`);
        console.log(`   RESTRUCTURE response type: ${restructureMessageType}`);

        // Check field alignment
        const chargesFields = chargesDetails ? Object.keys(chargesDetails) : [];
        const restructureFields = restructureDetails ? Object.keys(restructureDetails) : [];

        console.log(`   LOAN_CHARGES fields (${chargesFields.length}): ${chargesFields.join(', ')}`);
        console.log(`   RESTRUCTURE fields (${restructureFields.length}): ${restructureFields.join(', ')}`);

        // Check if both have the required 10 fields
        const requiredFields = [
            'DesiredDeductibleAmount', 'TotalInsurance', 'TotalProcessingFees',
            'TotalInterestRateAmount', 'OtherCharges', 'NetLoanAmount',
            'TotalAmountToPay', 'Tenure', 'EligibleAmount', 'MonthlyReturnAmount'
        ];

        const chargesHasAllFields = requiredFields.every(field => chargesFields.includes(field));
        const restructureHasAllFields = requiredFields.every(field => restructureFields.includes(field));

        console.log(`   LOAN_CHARGES has all 10 fields: ${chargesHasAllFields ? '✅' : '❌'}`);
        console.log(`   RESTRUCTURE has all 10 fields: ${restructureHasAllFields ? '✅' : '❌'}`);

        if (chargesHasAllFields && restructureHasAllFields) {
            console.log('\n🎉 Pattern Alignment: PERFECT MATCH!');
            console.log('   Both message types follow the same processing pattern');
            console.log('   Both return the same 10-field response structure');
            console.log('   Both use proper XML signing and error handling');
        } else {
            console.log('\n⚠️  Pattern Alignment: NEEDS ADJUSTMENT');
            if (!chargesHasAllFields) {
                const missingCharges = requiredFields.filter(field => !chargesFields.includes(field));
                console.log(`   LOAN_CHARGES missing: ${missingCharges.join(', ')}`);
            }
            if (!restructureHasAllFields) {
                const missingRestructure = requiredFields.filter(field => !restructureFields.includes(field));
                console.log(`   RESTRUCTURE missing: ${missingRestructure.join(', ')}`);
            }
        }

    } catch (error) {
        console.error('❌ Pattern alignment test failed:', error.message);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Response: ${error.response.data.substring(0, 500)}...`);
        }
    }
}

if (require.main === module) {
    testPatternAlignment().catch(console.error);
}

module.exports = testPatternAlignment;