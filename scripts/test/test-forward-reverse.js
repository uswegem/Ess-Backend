const LoanCalculations = require('./src/utils/loanCalculations');
const loanUtils = require('./src/utils/loanUtils');
const LOAN_CONSTANTS = require('./src/utils/loanConstants');

// Mock data
const baseData = {
    DeductibleAmount: 266667,
    OneThirdAmount: 333333,
    RetirementDate: '2045-01-01'
};

// Test FORWARD: RequestedAmount = 5000000 (less than max affordable)
console.log('Testing FORWARD mode (RequestedAmount < maxAffordable):');
const forwardData = { ...baseData, RequestedAmount: 5000000, DesiredDeductibleAmount: 0, Tenure: 96 };
simulateRequest(forwardData);

// Test REVERSE: RequestedAmount = 0
console.log('\nTesting REVERSE mode (RequestedAmount = 0):');
const reverseData = { ...baseData, RequestedAmount: 0, DesiredDeductibleAmount: 266667, Tenure: 96 };
simulateRequest(reverseData);

// Test FORWARD: RequestedAmount = 20000000 (greater than max affordable)
console.log('\nTesting FORWARD mode (RequestedAmount > maxAffordable):');
const forwardLargeData = { ...baseData, RequestedAmount: 20000000, DesiredDeductibleAmount: 0, Tenure: 96 };
simulateRequest(forwardLargeData);

function simulateRequest(data) {
    // Simulate the logic from handleLoanChargesRequest
    let requestedAmount = parseFloat(data.RequestedAmount);
    let requestedTenure = parseInt(data.Tenure);
    if (!requestedTenure || requestedTenure <= 0) {
        requestedTenure = LOAN_CONSTANTS.MAX_TENURE;
    }
    const retirementMonthsLeft = loanUtils.calculateMonthsUntilRetirement(data.RetirementDate);
    requestedTenure = loanUtils.validateRetirementAge(requestedTenure, retirementMonthsLeft);

    const interestRate = 15.0;

    const desiredDeductibleAmount = parseFloat(data.DesiredDeductibleAmount || 0);
    const deductibleAmount = parseFloat(data.DeductibleAmount || 0);

    let desirableEMI = 0;
    if (desiredDeductibleAmount > 0) {
        desirableEMI = Math.min(desiredDeductibleAmount, deductibleAmount);
    } else {
        desirableEMI = deductibleAmount;
    }

    const affordabilityType = (requestedAmount === 0 || requestedTenure === null) ? 'REVERSE' : 'FORWARD';

    const maxAffordableLoan = LoanCalculations.calculateMaxLoanFromEMI(desirableEMI, interestRate, requestedTenure);

    let eligibleAmount = 0;
    let monthlyReturnAmount = 0;

    if (affordabilityType === 'FORWARD') {
        eligibleAmount = Math.min(requestedAmount, maxAffordableLoan);
        monthlyReturnAmount = LoanCalculations.calculateEMI(eligibleAmount, interestRate, requestedTenure);
    } else {
        eligibleAmount = maxAffordableLoan;
        monthlyReturnAmount = desirableEMI;
    }

    eligibleAmount = Math.max(eligibleAmount, LOAN_CONSTANTS.MIN_LOAN_AMOUNT);

    console.log(`  AffordabilityType: ${affordabilityType}`);
    console.log(`  RequestedAmount: ${requestedAmount}`);
    console.log(`  MaxAffordableLoan: ${maxAffordableLoan.toFixed(2)}`);
    console.log(`  EligibleAmount: ${eligibleAmount.toFixed(2)}`);
    console.log(`  MonthlyReturnAmount: ${monthlyReturnAmount.toFixed(2)}`);
}