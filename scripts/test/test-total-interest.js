const axios = require('axios');

const API_URL = 'http://135.181.33.13:3002/api/loan';

async function testTotalInterestRateAmount() {
    console.log('\n==================================================');
    console.log('TESTING: TotalInterestRateAmount should be a valid number');
    console.log('==================================================\n');

    const tests = [
        {
            name: 'Test 1: Normal request with 5M TZS',
            requestedAmount: '5000000.00',
            tenure: '36',
            basicSalary: '2500000.00',
            netSalary: '1800000.00',
            desiredDeductible: '500000.00'
        },
        {
            name: 'Test 2: Small amount request 500K TZS',
            requestedAmount: '500000.00',
            tenure: '12',
            basicSalary: '1000000.00',
            netSalary: '800000.00',
            desiredDeductible: '100000.00'
        },
        {
            name: 'Test 3: Large amount request 10M TZS',
            requestedAmount: '10000000.00',
            tenure: '48',
            basicSalary: '5000000.00',
            netSalary: '3500000.00',
            desiredDeductible: '800000.00'
        }
    ];

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        await runTest(test, i + 1);
        if (i < tests.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log('\n==================================================');
    console.log('ALL TESTS COMPLETED');
    console.log('==================================================');
}

async function runTest(test, testNum) {
    console.log(`\n=== ${test.name} ===`);
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_${Date.now()}_${testNum}</MsgId>
            <MessageType>LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <DesignationCode>TZ800186</DesignationCode>
            <DesignationName>ICTO II</DesignationName>
            <BasicSalary>${test.basicSalary}</BasicSalary>
            <NetSalary>${test.netSalary}</NetSalary>
            <OneThirdAmount>600000.00</OneThirdAmount>
            <RequestedAmount>${test.requestedAmount}</RequestedAmount>
            <DeductibleAmount>300000.00</DeductibleAmount>
            <DesiredDeductibleAmount>${test.desiredDeductible}</DesiredDeductibleAmount>
            <RetirementDate>2030-12-31</RetirementDate>
            <TermsOfEmployment>Permanent and Pensionable</TermsOfEmployment>
            <Tenure>${test.tenure}</Tenure>
            <ProductCode>PROD001</ProductCode>
            <VoteCode>VC001</VoteCode>
            <TotalEmployeeDeduction>200000.00</TotalEmployeeDeduction>
            <JobClassCode>JB0012</JobClassCode>
            <LoanNumber>LOAN${Date.now()}</LoanNumber>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const response = await axios.post(API_URL, xml, {
            headers: { 'Content-Type': 'application/xml' }
        });

        const totalInterestMatch = response.data.match(/<TotalInterestRateAmount>([^<]+)<\/TotalInterestRateAmount>/);
        const eligibleAmountMatch = response.data.match(/<EligibleAmount>([^<]+)<\/EligibleAmount>/);
        const monthlyReturnMatch = response.data.match(/<MonthlyReturnAmount>([^<]+)<\/MonthlyReturnAmount>/);
        const totalToPayMatch = response.data.match(/<TotalAmountToPay>([^<]+)<\/TotalAmountToPay>/);
        
        if (totalInterestMatch) {
            const value = totalInterestMatch[1];
            const numValue = parseFloat(value);
            
            if (value === 'NaN' || isNaN(numValue)) {
                console.log('❌ FAIL: TotalInterestRateAmount is NaN or invalid');
                console.log('   Value:', value);
            } else {
                console.log('✅ PASS: TotalInterestRateAmount is valid');
                console.log('   Value:', numValue.toLocaleString('en-US', { minimumFractionDigits: 2 }), 'TZS');
            }
        } else {
            console.log('❌ ERROR: TotalInterestRateAmount not found in response');
        }
        
        if (eligibleAmountMatch) {
            console.log('   Eligible Amount:', parseFloat(eligibleAmountMatch[1]).toLocaleString('en-US', { minimumFractionDigits: 2 }), 'TZS');
        }
        
        if (monthlyReturnMatch) {
            console.log('   Monthly Return:', parseFloat(monthlyReturnMatch[1]).toLocaleString('en-US', { minimumFractionDigits: 2 }), 'TZS');
        }
        
        if (totalToPayMatch) {
            console.log('   Total to Pay:', parseFloat(totalToPayMatch[1]).toLocaleString('en-US', { minimumFractionDigits: 2 }), 'TZS');
        }
        
    } catch (error) {
        console.error('❌ Request Error:', error.response?.status || error.message);
        if (error.response?.data) {
            const totalInterestMatch = error.response.data.match(/<TotalInterestRateAmount>([^<]+)<\/TotalInterestRateAmount>/);
            if (totalInterestMatch) {
                console.log('   TotalInterestRateAmount in error response:', totalInterestMatch[1]);
            }
        }
    }
}

testTotalInterestRateAmount();
