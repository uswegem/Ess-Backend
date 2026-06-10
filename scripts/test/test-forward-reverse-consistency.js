const axios = require('axios');
const xml2js = require('xml2js');

async function testForwardReverse() {
    const testParams = {
        requestedAmount: 100000,
        tenure: 12,
        deductibleAmount: 5000,
        employeeId: 'EMP123'
    };

    // Test Forward calculation
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
            <RequestedAmount>${testParams.requestedAmount}</RequestedAmount>
            <Tenure>${testParams.tenure}</Tenure>
            <DeductibleAmount>${testParams.deductibleAmount}</DeductibleAmount>
            <EmployeeId>${testParams.employeeId}</EmployeeId>
            <CalculationType>Forward</CalculationType>
        </MessageDetails>
    </Data>
</Document>`;

    // Test Reverse calculation
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
            <RequestedAmount>${testParams.requestedAmount}</RequestedAmount>
            <Tenure>${testParams.tenure}</Tenure>
            <DeductibleAmount>${testParams.deductibleAmount}</DeductibleAmount>
            <EmployeeId>${testParams.employeeId}</EmployeeId>
            <CalculationType>Reverse</CalculationType>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        console.log('Testing Forward vs Reverse calculation consistency...\n');
        
        // Test Forward
        console.log('🔄 Testing FORWARD calculation...');
        const forwardResponse = await axios.post('http://localhost:3002/api/loan', forwardXml, {
            headers: { 'Content-Type': 'application/xml' }
        });
        
        const parser = new xml2js.Parser();
        const forwardResult = await parser.parseStringPromise(forwardResponse.data);
        const forwardDetails = forwardResult.Document.Data[0].MessageDetails[0];
        
        console.log('Forward Results:');
        console.log(`  Monthly Return Amount: ${forwardDetails.MonthlyReturnAmount?.[0] || 'N/A'}`);
        console.log(`  Total Processing Fees: ${forwardDetails.TotalProcessingFees?.[0] || 'N/A'}`);
        console.log(`  Total Amount To Pay: ${forwardDetails.TotalAmountToPay?.[0] || 'N/A'}`);
        console.log(`  Eligible Amount: ${forwardDetails.EligibleAmount?.[0] || 'N/A'}`);
        console.log(`  Net Loan Amount: ${forwardDetails.NetLoanAmount?.[0] || 'N/A'}`);
        
        // Test Reverse
        console.log('\n🔄 Testing REVERSE calculation...');
        const reverseResponse = await axios.post('http://localhost:3002/api/loan', reverseXml, {
            headers: { 'Content-Type': 'application/xml' }
        });
        
        const reverseResult = await parser.parseStringPromise(reverseResponse.data);
        const reverseDetails = reverseResult.Document.Data[0].MessageDetails[0];
        
        console.log('Reverse Results:');
        console.log(`  Monthly Return Amount: ${reverseDetails.MonthlyReturnAmount?.[0] || 'N/A'}`);
        console.log(`  Total Processing Fees: ${reverseDetails.TotalProcessingFees?.[0] || 'N/A'}`);
        console.log(`  Total Amount To Pay: ${reverseDetails.TotalAmountToPay?.[0] || 'N/A'}`);
        console.log(`  Eligible Amount: ${reverseDetails.EligibleAmount?.[0] || 'N/A'}`);
        console.log(`  Net Loan Amount: ${reverseDetails.NetLoanAmount?.[0] || 'N/A'}`);
        
        // Compare results
        console.log('\n📊 COMPARISON:');
        const forwardEMI = parseFloat(forwardDetails.MonthlyReturnAmount?.[0] || 0);
        const reverseEMI = parseFloat(reverseDetails.MonthlyReturnAmount?.[0] || 0);
        const forwardEligible = parseFloat(forwardDetails.EligibleAmount?.[0] || 0);
        const reverseEligible = parseFloat(reverseDetails.EligibleAmount?.[0] || 0);
        
        console.log(`EMI Difference: ${Math.abs(forwardEMI - reverseEMI).toFixed(2)}`);
        console.log(`Eligible Amount Difference: ${Math.abs(forwardEligible - reverseEligible).toFixed(2)}`);
        
        if (Math.abs(forwardEMI - reverseEMI) < 0.01 && Math.abs(forwardEligible - reverseEligible) < 0.01) {
            console.log('✅ PASS: Forward and Reverse calculations are consistent!');
        } else {
            console.log('❌ FAIL: Forward and Reverse calculations are inconsistent!');
            console.log('This indicates a calculation logic issue that needs fixing.');
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response && error.response.data) {
            console.error('Response:', error.response.data);
        }
    }
}

testForwardReverse();