const axios = require('axios');
const xml2js = require('xml2js');

async function testConsistencyFix() {
    console.log('🧪 Testing Forward vs Reverse calculation consistency fix...\n');
    
    // Test parameters - using real employee data structure
    const testParams = {
        checkNumber: '11139834',
        designationCode: 'TZ4000718',
        designationName: 'Senior Records Management Assistant I',
        basicSalary: 1000000.00,
        netSalary: 600000.00,
        oneThirdAmount: 333333.00,
        deductibleAmount: 266667.00,
        retirementDate: 240,
        termsOfEmployment: 'CONTRUCT',
        productCode: 17,
        voteCode: 32,
        totalEmployeeDeduction: 400000.00,
        jobClassCode: 'JBCA718'
    };

    // STEP 1: Do Reverse calculation to get maximum net loan amount
    console.log('🔄 STEP 1: Reverse calculation to find maximum net loan...');
    
    const reverseXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_REVERSE_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>${testParams.checkNumber}</CheckNumber>
            <DesignationCode>${testParams.designationCode}</DesignationCode>
            <DesignationName>${testParams.designationName}</DesignationName>
            <BasicSalary>${testParams.basicSalary}</BasicSalary>
            <NetSalary>${testParams.netSalary}</NetSalary>
            <OneThirdAmount>${testParams.oneThirdAmount}</OneThirdAmount>
            <RequestedAmount>0.00</RequestedAmount>
            <DeductibleAmount>${testParams.deductibleAmount}</DeductibleAmount>
            <DesiredDeductibleAmount>${testParams.deductibleAmount}</DesiredDeductibleAmount>
            <RetirementDate>${testParams.retirementDate}</RetirementDate>
            <TermsOfEmployment>${testParams.termsOfEmployment}</TermsOfEmployment>
            <Tenure>96</Tenure>
            <ProductCode>${testParams.productCode}</ProductCode>
            <VoteCode>${testParams.voteCode}</VoteCode>
            <TotalEmployeeDeduction>${testParams.totalEmployeeDeduction}</TotalEmployeeDeduction>
            <JobClassCode>${testParams.jobClassCode}</JobClassCode>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const reverseResponse = await axios.post('http://localhost:3002/api/loan', reverseXml, {
            headers: { 'Content-Type': 'application/xml' }
        });
        
        const parser = new xml2js.Parser();
        const reverseResult = await parser.parseStringPromise(reverseResponse.data);
        const reverseDetails = reverseResult.Document.Data[0].MessageDetails[0];
        
        const maxNetLoanAmount = parseFloat(reverseDetails.NetLoanAmount[0]);
        const maxEligibleAmount = parseFloat(reverseDetails.EligibleAmount[0]);
        const maxMonthlyReturn = parseFloat(reverseDetails.MonthlyReturnAmount[0]);
        
        console.log(`📊 Reverse Results:`);
        console.log(`   Net Loan Amount: ${maxNetLoanAmount.toLocaleString()}`);
        console.log(`   Eligible Amount: ${maxEligibleAmount.toLocaleString()}`);
        console.log(`   Monthly Return: ${maxMonthlyReturn.toLocaleString()}`);
        
        // STEP 2: Use that net loan amount in Forward calculation
        console.log(`\\n🔄 STEP 2: Forward calculation requesting net amount: ${maxNetLoanAmount.toLocaleString()}`);
        
        const forwardXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_FORWARD_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>${testParams.checkNumber}</CheckNumber>
            <DesignationCode>${testParams.designationCode}</DesignationCode>
            <DesignationName>${testParams.designationName}</DesignationName>
            <BasicSalary>${testParams.basicSalary}</BasicSalary>
            <NetSalary>${testParams.netSalary}</NetSalary>
            <OneThirdAmount>${testParams.oneThirdAmount}</OneThirdAmount>
            <RequestedAmount>${maxNetLoanAmount}</RequestedAmount>
            <DeductibleAmount>${testParams.deductibleAmount}</DeductibleAmount>
            <DesiredDeductibleAmount>0.00</DesiredDeductibleAmount>
            <RetirementDate>${testParams.retirementDate}</RetirementDate>
            <TermsOfEmployment>${testParams.termsOfEmployment}</TermsOfEmployment>
            <Tenure>0</Tenure>
            <ProductCode>${testParams.productCode}</ProductCode>
            <VoteCode>${testParams.voteCode}</VoteCode>
            <TotalEmployeeDeduction>${testParams.totalEmployeeDeduction}</TotalEmployeeDeduction>
            <JobClassCode>${testParams.jobClassCode}</JobClassCode>
        </MessageDetails>
    </Data>
</Document>`;

        const forwardResponse = await axios.post('http://localhost:3002/api/loan', forwardXml, {
            headers: { 'Content-Type': 'application/xml' }
        });
        
        const forwardResult = await parser.parseStringPromise(forwardResponse.data);
        const forwardDetails = forwardResult.Document.Data[0].MessageDetails[0];
        
        const forwardNetLoan = parseFloat(forwardDetails.NetLoanAmount[0]);
        const forwardEligible = parseFloat(forwardDetails.EligibleAmount[0]);
        const forwardMonthlyReturn = parseFloat(forwardDetails.MonthlyReturnAmount[0]);
        
        console.log(`📊 Forward Results:`);
        console.log(`   Net Loan Amount: ${forwardNetLoan.toLocaleString()}`);
        console.log(`   Eligible Amount: ${forwardEligible.toLocaleString()}`);
        console.log(`   Monthly Return: ${forwardMonthlyReturn.toLocaleString()}`);
        
        // STEP 3: Compare results
        console.log(`\\n🔍 CONSISTENCY CHECK:`);
        
        const netLoanDifference = Math.abs(maxNetLoanAmount - forwardNetLoan);
        const eligibleDifference = Math.abs(maxEligibleAmount - forwardEligible);
        const emiDifference = Math.abs(maxMonthlyReturn - forwardMonthlyReturn);
        
        console.log(`   Net Loan Difference: ${netLoanDifference.toFixed(2)} (${((netLoanDifference/maxNetLoanAmount)*100).toFixed(4)}%)`);
        console.log(`   Eligible Amount Difference: ${eligibleDifference.toFixed(2)} (${((eligibleDifference/maxEligibleAmount)*100).toFixed(4)}%)`);
        console.log(`   EMI Difference: ${emiDifference.toFixed(2)} (${((emiDifference/maxMonthlyReturn)*100).toFixed(4)}%)`);
        
        // Check if results are consistent (within 0.1% tolerance)
        const tolerance = 0.001; // 0.1% tolerance
        const netLoanConsistent = (netLoanDifference/maxNetLoanAmount) < tolerance;
        const eligibleConsistent = (eligibleDifference/maxEligibleAmount) < tolerance;
        const emiConsistent = (emiDifference/maxMonthlyReturn) < tolerance;
        
        if (netLoanConsistent && eligibleConsistent && emiConsistent) {
            console.log(`\\n✅ SUCCESS: Forward and Reverse calculations are now CONSISTENT!`);
            console.log(`   All differences are within acceptable tolerance (< 0.1%)`);
        } else {
            console.log(`\\n❌ ISSUE: Calculations still not consistent:`);
            if (!netLoanConsistent) console.log(`   - Net Loan Amount difference too high`);
            if (!eligibleConsistent) console.log(`   - Eligible Amount difference too high`);
            if (!emiConsistent) console.log(`   - EMI difference too high`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response && error.response.data) {
            console.error('Response data:', error.response.data);
        }
    }
}

testConsistencyFix();