const LoanCalculations = require('./loanCalculations');

describe('LoanCalculations core', () => {
  test('calculateEMI and calculateMaxLoanFromEMI are consistent', async () => {
    const principal = 1_000_000;
    const annualRate = 15;
    const tenure = 24;
    const emi = await LoanCalculations.calculateEMI(principal, annualRate, tenure);
    const reconPrincipal = await LoanCalculations.calculateMaxLoanFromEMI(emi, annualRate, tenure);

    const diff = Math.abs(reconPrincipal - principal);
    expect(diff).toBeLessThanOrEqual(1.5);
  });

  test('calculateTotalInterest reasonable', async () => {
    const principal = 500_000;
    const annualRate = 12;
    const tenure = 12;
    const totalInterest = await LoanCalculations.calculateTotalInterest(principal, annualRate, tenure);

    expect(totalInterest).toBeGreaterThan(0);
    expect(totalInterest).toBeLessThan(principal);
  });

  test('calculateMaxLoanFromEMI yields principal that produces similar EMI', async () => {
    const targetEMI = 50000;
    const annualRate = 15;
    const tenure = 36;
    const principal = await LoanCalculations.calculateMaxLoanFromEMI(targetEMI, annualRate, tenure);

    const impliedEMI = await LoanCalculations.calculateEMI(principal, annualRate, tenure);
    const diff = Math.abs(impliedEMI - targetEMI);
    expect(diff).toBeLessThanOrEqual(1.5);
  });

  test('calculateCharges returns object with fees', () => {
    const principal = 1_000_000;
    const charges = LoanCalculations.calculateCharges(principal);
    expect(charges.processingFee).toBeGreaterThan(0);
    expect(charges.insurance).toBeGreaterThan(0);
    expect(charges.otherCharges).toBeDefined();
  });

  test('amortizationSchedule sums correctly', async () => {
    const principal = 300_000;
    const annualRate = 10;
    const tenure = 12;
    const sched = await LoanCalculations.amortizationSchedule(principal, annualRate, tenure);
    expect(sched.length).toEqual(tenure);

    const totalPrincipal = sched.reduce((s, r) => s + Number(r.principal), 0);
    const diff = Math.abs(totalPrincipal - principal);
    expect(diff).toBeLessThanOrEqual(2.0);
  });
});