const LoanCalculations = require('./src/utils/loanCalculations');
const loanUtils = require('./src/utils/loanUtils');
const LOAN_CONSTANTS = require('./src/utils/loanConstants');

// Mock customer data (same for all scenarios)
const baseData = {
    DeductibleAmount: 266667,
    OneThirdAmount: 333333,
    RetirementDate: '2045-01-01' // Mock retirement
};

// Scenarios to test: providing different combinations of RequestedAmount, DesiredDeductibleAmount, Tenure
const scenarios = [
    { name: 'Only Tenure provided (DesiredDeductibleAmount=0, RequestedAmount=0)', RequestedAmount: 0, DesiredDeductibleAmount: 0, Tenure: 96 },
    { name: 'Tenure and DesiredDeductibleAmount provided (RequestedAmount=0)', RequestedAmount: 0, DesiredDeductibleAmount: 266667, Tenure: 96 },
    { name: 'Tenure and RequestedAmount provided (DesiredDeductibleAmount=0)', RequestedAmount: 5000000, DesiredDeductibleAmount: 0, Tenure: 96 },
    { name: 'All provided', RequestedAmount: 10000000, DesiredDeductibleAmount: 266667, Tenure: 96 },
    { name: 'RequestedAmount matches max affordable', RequestedAmount: 14859904, DesiredDeductibleAmount: 266667, Tenure: 96 },
    { name: 'Different Tenure (84 months)', RequestedAmount: 0, DesiredDeductibleAmount: 266667, Tenure: 84 },
];

function simulateCalculation(data) {
    console.log(`\nScenario: ${data.name}`);

    // Merge with base data
    const fullData = { ...baseData, ...data };

    // Input validation
    let requestedAmount = parseFloat(fullData.RequestedAmount);
    let requestedTenure = parseInt(fullData.Tenure);
    if (!requestedTenure || requestedTenure <= 0) {
        requestedTenure = LOAN_CONSTANTS.MAX_TENURE;
    }
    const retirementMonthsLeft = loanUtils.calculateMonthsUntilRetirement(fullData.RetirementDate);
    requestedTenure = loanUtils.validateRetirementAge(requestedTenure, retirementMonthsLeft);

    const interestRate = 15.0;

    // Repayment capacity
    const desiredDeductibleAmount = parseFloat(fullData.DesiredDeductibleAmount || 0);
    const deductibleAmount = parseFloat(fullData.DeductibleAmount || 0);

    let targetEMI = 0;
    if (desiredDeductibleAmount > 0) {
        targetEMI = desiredDeductibleAmount;
    } else if (deductibleAmount > 0) {
        targetEMI = deductibleAmount;
    }

    // Calculate max affordable
    let maxAffordableAmount = LOAN_CONSTANTS.MIN_LOAN_AMOUNT;
    if (targetEMI > 0 && requestedTenure > 0) {
        maxAffordableAmount = LoanCalculations.calculateMaxLoanFromEMI(targetEMI, interestRate, requestedTenure);
    }

    // Unified calculation: Use RequestedAmount if provided and matches max affordable, else use max affordable
    let eligibleAmount = maxAffordableAmount;
    let monthlyReturnAmount = targetEMI;

    if (fullData.RequestedAmount > 0 && Math.abs(fullData.RequestedAmount - maxAffordableAmount) < 1) { // Allow small rounding differences
        eligibleAmount = fullData.RequestedAmount;
    }

    // Charges
    const charges = LoanCalculations.calculateCharges(eligibleAmount);
    const totalInterestRateAmount = LoanCalculations.calculateTotalInterest(eligibleAmount, interestRate, requestedTenure);
    const totalDeductions = charges.processingFee + charges.insurance + charges.otherCharges;
    const netLoanAmount = eligibleAmount - totalDeductions;
    const totalAmountToPay = eligibleAmount + totalInterestRateAmount;

    console.log(`  Target EMI: ${targetEMI.toFixed(2)}`);
    console.log(`  Tenure: ${requestedTenure}`);
    console.log(`  Max Affordable Amount: ${maxAffordableAmount.toFixed(2)}`);
    console.log(`  EligibleAmount: ${eligibleAmount.toFixed(2)}`);
    console.log(`  MonthlyReturnAmount: ${monthlyReturnAmount.toFixed(2)}`);
    console.log(`  TotalAmountToPay: ${totalAmountToPay.toFixed(2)}`);
}

console.log('Testing Calculation Consistency with Different Input Combinations:');
scenarios.forEach(scenario => simulateCalculation(scenario));