const { LoanCalculate } = require('./src/services/loanService');
const LOAN_CONSTANTS = require('./src/utils/loanConstants');

async function testNewLoanChargesLogic() {
    console.log('🧪 Testing new enhanced loan charges logic...');

    try {
        // Test data matching the UtumishiOfferRequest structure
        const testData = {
            checkNumber: LOAN_CONSTANTS.TEST_CHECK_NUMBER,
            designationCode: 'DC001',
            designationName: 'Software Engineer',
            basicSalary: LOAN_CONSTANTS.TEST_BASIC_SALARY, // 2,000,000 TZS
            netSalary: LOAN_CONSTANTS.TEST_NET_SALARY, // 1,800,000 TZS
            oneThirdAmount: LOAN_CONSTANTS.TEST_ONE_THIRD_AMOUNT, // 600,000 TZS
            deductibleAmount: LOAN_CONSTANTS.TEST_DEDUCTIBLE_AMOUNT, // 500,000 TZS (desired EMI)
            retirementDate: LOAN_CONSTANTS.TEST_RETIREMENT_DATE, // Far in future
            termsOfEmployment: 'PERMANENT',
            requestedAmount: LOAN_CONSTANTS.TEST_LOAN_AMOUNT, // 5,000,000 TZS
            desiredDeductibleAmount: LOAN_CONSTANTS.TEST_DEDUCTIBLE_AMOUNT, // 500,000 TZS
            tenure: LOAN_CONSTANTS.DEFAULT_TENURE,
            fspCode: LOAN_CONSTANTS.FSP_CODE,
            productCode: 'DAS',
            voteCode: 'V001',
            totalEmployeeDeduction: LOAN_CONSTANTS.TEST_TOTAL_EMPLOYEE_DEDUCTION, // 200,000 TZS
            jobClassCode: 'JCC001'
        };

        console.log('📊 Test Input Data:', testData);

        const result = await LoanCalculate(testData);

        console.log('✅ Loan Charges Calculation Result:');
        console.log(JSON.stringify(result, null, 2));

        // Verify the response structure
        const expectedFields = [
            'monthlyReturnAmount',
            'tenure',
            'totalAmountToPay',
            'netLoanAmount',
            'eligibleAmount',
            'totalInterestRateAmount',
            'totalProcessingFees',
            'totalInsurance',
            'otherCharges',
            'desiredDeductibleAmount'
        ];

        const missingFields = expectedFields.filter(field => !(field in result));
        if (missingFields.length > 0) {
            console.error('❌ Missing fields in response:', missingFields);
        } else {
            console.log('✅ All expected fields present in response');
        }

        // Verify numeric values are strings
        const numericFields = [
            'monthlyReturnAmount',
            'totalAmountToPay',
            'netLoanAmount',
            'eligibleAmount',
            'totalInterestRateAmount',
            'totalProcessingFees',
            'totalInsurance',
            'otherCharges',
            'desiredDeductibleAmount'
        ];

        for (const field of numericFields) {
            if (typeof result[field] !== 'string') {
                console.error(`❌ Field ${field} should be string, got ${typeof result[field]}`);
            }
        }

        console.log('✅ Response validation completed');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.errorCode) {
            console.error('Error Code:', error.errorCode);
            console.error('Error Message:', error.errorMsg);
        }
    }
}

// Run the test
testNewLoanChargesLogic().then(() => {
    console.log('🧪 Test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
});