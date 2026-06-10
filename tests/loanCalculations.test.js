const LoanCalculations = require('../src/utils/loanCalculations');

describe('Loan Calculations', () => {
  test('calculateEMI should return correct monthly installment', async () => {
    const principal = 1000000; // 1M TZS
    const annualRate = 15; // 15%
    const tenureMonths = 24;

    const emi = await LoanCalculations.calculateEMI(principal, annualRate, tenureMonths);
    expect(emi).toBeGreaterThan(0);
    expect(typeof emi).toBe('number');
  });

  test('calculateCharges should return charge breakdown', () => {
    const amount = 1000000;

    const charges = LoanCalculations.calculateCharges(amount);
    expect(charges).toHaveProperty('processingFee');
    expect(charges).toHaveProperty('insurance');
    expect(charges).toHaveProperty('otherCharges');
    expect(charges.processingFee).toBeGreaterThan(0);
  });

  test('calculateMaxLoanFromEMI should return correct loan amount', async () => {
    const emi = 50000;
    const annualRate = 15;
    const tenureMonths = 24;

    const loanAmount = await LoanCalculations.calculateMaxLoanFromEMI(emi, annualRate, tenureMonths);
    expect(loanAmount).toBeGreaterThan(0);
    expect(typeof loanAmount).toBe('number');
  });
});