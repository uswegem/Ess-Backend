const LOAN_CONSTANTS = require('./loanConstants');
const cacheService = require('./cacheService');

// Use Decimal.js-light for precision if available
let Decimal;
try {
  Decimal = require('decimal.js-light');
} catch (e) {
  Decimal = null;
}

/** Internal helpers for Decimal or Number */
const D = (v) => (Decimal ? new Decimal(v) : Number(v));
const add = (a, b) => (Decimal ? a.plus(b) : a + b);
const sub = (a, b) => (Decimal ? a.minus(b) : a - b);
const mul = (a, b) => (Decimal ? a.times(b) : a * b);
const div = (a, b) => (Decimal ? a.div(b) : a / b);
const pow = (a, b) => (Decimal ? a.pow(b) : Math.pow(a, b));
const toNumber = (a) => (Decimal ? a.toNumber() : a);
const round2 = (n) => {
  if (Decimal) return Number(new Decimal(n).toFixed(2));
  return Math.round(n * 100) / 100;
};

/**
 * Centralized loan calculation utilities
 * Single source of truth for all EMI and loan-related calculations
 */
class LoanCalculations {
  /**
   * Calculate monthly EMI using standard amortization formula
   * @param {number} principal - Loan principal amount
   * @param {number} annualInterestRate - Annual interest rate (percentage)
   * @param {number} tenureMonths - Loan tenure in months
   * @returns {number} Monthly EMI amount
   */
  static async calculateEMI(principal, annualInterestRate, tenureMonths) {
    if (!principal || principal <= 0) return 0;
    if (!tenureMonths || tenureMonths <= 0) return 0;

    // Create cache key for this calculation
    const cacheKey = `calc_emi:${principal}:${annualInterestRate}:${tenureMonths}`;

    // Try to get cached result first
    const cachedResult = cacheService.get ?
      await cacheService.get(cacheKey) :
      null;

    if (cachedResult) {
      return cachedResult;
    }

    const monthlyRate = annualInterestRate / 100 / 12;

    if (monthlyRate === 0) {
      const result = round2(principal / tenureMonths);
      // Cache the result
      if (cacheService.set) {
        await cacheService.set(cacheKey, result, 1800); // 30 minutes
      }
      return result;
    }

    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);

    const result = round2(emi);

    // Cache the result
    if (cacheService.set) {
      await cacheService.set(cacheKey, result, 1800); // 30 minutes
    }

    return result;
  }

  /**
   * Calculate maximum loan amount from target EMI (reverse calculation)
   * @param {number} targetEMI - Target monthly EMI
   * @param {number} annualInterestRate - Annual interest rate (percentage)
   * @param {number} tenureMonths - Loan tenure in months
   * @returns {number} Maximum loan amount
   */
  static async calculateMaxLoanFromEMI(targetEMI, annualInterestRate, tenureMonths) {
    if (!targetEMI || targetEMI <= 0) return 0;
    if (!tenureMonths || tenureMonths <= 0) return 0;

    // Create cache key for this calculation
    const cacheKey = `calc_max_loan:${targetEMI}:${annualInterestRate}:${tenureMonths}`;

    // Try to get cached result first
    const cachedResult = cacheService.get ?
      await cacheService.get(cacheKey) :
      null;

    if (cachedResult) {
      return cachedResult;
    }

    const monthlyRate = annualInterestRate / 100 / 12;

    if (monthlyRate === 0) {
      const result = round2(targetEMI * tenureMonths);
      // Cache the result
      if (cacheService.set) {
        await cacheService.set(cacheKey, result, 1800); // 30 minutes
      }
      return result;
    }

    const maxAmount = (targetEMI * (Math.pow(1 + monthlyRate, tenureMonths) - 1)) /
                      (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));

    const result = Math.max(LOAN_CONSTANTS.MIN_LOAN_AMOUNT, round2(maxAmount));

    // Cache the result
    if (cacheService.set) {
      await cacheService.set(cacheKey, result, 1800); // 30 minutes
    }

    return result;
  }

  /**
   * Calculate tenure from target EMI (reverse calculation)
   * Used when EMI is provided and we need to find the required tenure
   * @param {number} principal - Loan principal amount
   * @param {number} annualInterestRate - Annual interest rate (percentage)
   * @param {number} targetEMI - Target monthly EMI
   * @returns {number} Required tenure in months
   */
  static async calculateTenureFromEMI(principal, annualInterestRate, targetEMI) {
    if (!principal || principal <= 0) return 0;
    if (!targetEMI || targetEMI <= 0) return 0;

    const monthlyRate = annualInterestRate / 100 / 12;

    if (monthlyRate === 0) {
      // Simple division when no interest
      return Math.ceil(principal / targetEMI);
    }

    // Formula: n = -log(1 - (P * r / EMI)) / log(1 + r)
    // Where P = principal, r = monthly rate, EMI = monthly payment
    const numerator = principal * monthlyRate;
    
    // Check if EMI is sufficient to cover interest
    if (targetEMI <= numerator) {
      // EMI is too small to ever pay off the loan
      // Return maximum allowed tenure
      return LOAN_CONSTANTS.MAX_TENURE || 96;
    }

    const logArg = 1 - (numerator / targetEMI);
    
    if (logArg <= 0) {
      return LOAN_CONSTANTS.MAX_TENURE || 96;
    }

    const tenure = -Math.log(logArg) / Math.log(1 + monthlyRate);
    
    // Round up to nearest whole month and cap at max tenure
    const maxTenure = LOAN_CONSTANTS.MAX_TENURE || 96;
    return Math.min(Math.ceil(tenure), maxTenure);
  }

  /**
   * Calculate total interest for loan
   * @param {number} principal - Loan principal amount
   * @param {number} annualInterestRate - Annual interest rate (percentage)
   * @param {number} tenureMonths - Loan tenure in months
   * @returns {number} Total interest amount
   */
  static async calculateTotalInterest(principal, annualInterestRate, tenureMonths) {
    if (!principal || principal <= 0) return 0;
    const emi = await this.calculateEMI(principal, annualInterestRate, tenureMonths);
    const totalPaid = emi * tenureMonths;
    const totalInterest = totalPaid - principal;
    return round2(totalInterest);
  }

  /**
   * Calculate loan charges breakdown
   * @param {number} loanAmount - Principal loan amount
   * @returns {object} Breakdown of charges
   */
  static calculateCharges(loanAmount) {
    return {
      processingFee: round2(loanAmount * (LOAN_CONSTANTS?.ADMIN_FEE_RATE || 0.02)),
      insurance: round2(loanAmount * (LOAN_CONSTANTS?.INSURANCE_RATE || 0.015)),
      otherCharges: LOAN_CONSTANTS?.OTHER_CHARGES || 50000
    };
  }

  /**
   * Generate amortization schedule
   * @param {number} principal
   * @param {number} annualRatePercent
   * @param {number} tenureMonths
   * @returns {array} Schedule
   */
  static async amortizationSchedule(principal, annualRatePercent, tenureMonths) {
    const schedule = [];
    if (!principal || principal <= 0 || !tenureMonths || tenureMonths <= 0) return schedule;

    const r = annualRatePercent / 100 / 12;
    let balance = principal;
    const emi = await this.calculateEMI(principal, annualRatePercent, tenureMonths);

    for (let m = 1; m <= tenureMonths; m++) {
      const interest = balance * r;
      let principalRepayment = emi - interest;

      if (m === tenureMonths) {
        principalRepayment = balance;
      }

      const closing = balance - principalRepayment;

      schedule.push({
        month: m,
        openingBalance: round2(balance),
        interest: round2(interest),
        principal: round2(principalRepayment),
        emi: round2(emi),
        closingBalance: round2(closing)
      });

      balance = closing;
    }

    if (schedule.length > 0) {
      schedule[schedule.length - 1].closingBalance = 0.00;
    }

    return schedule;
  }

  /**
   * Calculate monthly installment (deprecated, use calculateEMI)
   * @param {number} principal - Loan principal amount
   * @param {number} annualRate - Annual interest rate (percentage)
   * @param {number} termMonths - Loan tenure in months
   * @returns {number} Monthly installment amount
   */
  static async calculateMonthlyInstallment(principal, annualRate, termMonths) {
    return await this.calculateEMI(principal, annualRate, termMonths);
  }
}

module.exports = LoanCalculations;
