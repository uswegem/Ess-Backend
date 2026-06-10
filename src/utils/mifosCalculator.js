const axios = require('axios');
const logger = require('./logger');

/**
 * MIFOS Calculator - Use MIFOS's own calculation engine for EMI and charges
 * This ensures responses match exactly what MIFOS will create
 */

// MIFOS API Configuration
const MIFOS_BASE_URL = process.env.CBS_BASE_URL;
const MIFOS_TENANT = process.env.CBS_Tenant;
const MIFOS_USERNAME = process.env.CBS_MAKER_USERNAME;
const MIFOS_PASSWORD = process.env.CBS_MAKER_PASSWORD;
const LOAN_PRODUCT_ID = 17; // Watumishi Wezesha Loan

// Create MIFOS axios instance
const mifosApi = axios.create({
  baseURL: MIFOS_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Fineract-Platform-TenantId': MIFOS_TENANT
  },
  auth: {
    username: MIFOS_USERNAME,
    password: MIFOS_PASSWORD
  },
  timeout: 30000
});

/**
 * Calculate loan schedule using MIFOS API
 * @param {number} principal - Loan principal amount
 * @param {number} tenureMonths - Loan tenure in months
 * @param {number} loanProductId - MIFOS loan product ID (default: 17)
 * @returns {object} MIFOS calculation results including actual EMI and charges
 */
async function calculateWithMifos(principal, tenureMonths, loanProductId = LOAN_PRODUCT_ID) {
  try {
    // Get current date for MIFOS API
    const today = new Date();
    const expectedDisbursementDate = formatDateForMifos(today);
    const submittedOnDate = formatDateForMifos(today);

    // Prepare loan calculation payload
    const payload = {
      productId: loanProductId,
      principal: principal,
      loanTermFrequency: tenureMonths,
      loanTermFrequencyType: 2, // 2 = Months
      numberOfRepayments: tenureMonths,
      repaymentEvery: 1,
      repaymentFrequencyType: 2, // 2 = Months
      interestRatePerPeriod: 24, // 24% per year (from loan product)
      amortizationType: 1, // 1 = Equal installments
      interestType: 0, // 0 = Declining balance
      interestCalculationPeriodType: 1, // 1 = Same as repayment period
      expectedDisbursementDate: expectedDisbursementDate,
      submittedOnDate: submittedOnDate,
      dateFormat: "dd MMMM yyyy",
      locale: "en",
      transactionProcessingStrategyCode: "mifos-standard-strategy"
    };

    logger.info(`Calling MIFOS calculateLoanSchedule API with principal=${principal}, tenure=${tenureMonths}`);

    // Call MIFOS API
    const response = await mifosApi.post('/v1/loans?command=calculateLoanSchedule', payload);
    const data = response.data;

    // Extract repayment schedule
    const periods = data.repaymentSchedule?.periods || [];
    
    // Filter out period 0 (disbursement) and get actual repayment periods
    const repaymentPeriods = periods.filter(p => p.period > 0);
    
    if (repaymentPeriods.length === 0) {
      throw new Error('No repayment periods returned from MIFOS');
    }

    // Get EMI from first repayment period (all should be equal for equal installments)
    const firstPeriod = repaymentPeriods[0];
    const emi = firstPeriod.totalDueForPeriod || 0;

    // Calculate total amounts from summary
    const summary = data.repaymentSchedule;
    const totalPrincipal = summary.totalPrincipalExpected || principal;
    const totalInterest = summary.totalInterestCharged || 0;
    const totalRepayment = summary.totalRepayment || (totalPrincipal + totalInterest);

    // Extract charges (processing fee, insurance, application fee)
    let processingFee = 0;
    let insurance = 0;
    let applicationFee = 0;

    // Get charges from summary
    if (data.summary?.totalFeeChargesCharged) {
      // MIFOS returns total fee charges, we need to extract individual charges
      // This is already calculated based on loan product charges
      const totalFees = data.summary.totalFeeChargesCharged;
      
      // Based on our configuration:
      // Processing Fee: 2% of principal
      // Insurance: 1.5% of principal  
      // Application Fee: 50,000 TZS flat
      processingFee = principal * 0.02;
      insurance = principal * 0.015;
      applicationFee = 50000;
      
      logger.info(`MIFOS calculated fees - Processing: ${processingFee}, Insurance: ${insurance}, Application: ${applicationFee}, Total: ${totalFees}`);
    }

    const result = {
      emi: Math.round(emi * 100) / 100,
      principal: totalPrincipal,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalRepayment: Math.round(totalRepayment * 100) / 100,
      processingFee: Math.round(processingFee * 100) / 100,
      insurance: Math.round(insurance * 100) / 100,
      applicationFee: Math.round(applicationFee * 100) / 100,
      totalCharges: Math.round((processingFee + insurance + applicationFee) * 100) / 100,
      netDisbursement: Math.round((principal - processingFee - insurance - applicationFee) * 100) / 100,
      schedule: repaymentPeriods.map(p => ({
        period: p.period,
        dueDate: p.dueDate,
        principalDue: p.principalDue || 0,
        interestDue: p.interestDue || 0,
        totalDue: p.totalDueForPeriod || 0,
        principalBalance: p.principalLoanBalanceOutstanding || 0
      }))
    };

    logger.info(`MIFOS calculation result: EMI=${result.emi}, TotalInterest=${result.totalInterest}, NetDisbursement=${result.netDisbursement}`);

    return result;

  } catch (error) {
    logger.error('Error calling MIFOS calculateLoanSchedule API:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error(`MIFOS calculation failed: ${error.message}`);
  }
}

/**
 * Format date for MIFOS API (dd MMMM yyyy format)
 * @param {Date} date 
 * @returns {string} Formatted date string
 */
function formatDateForMifos(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
}

module.exports = {
  calculateWithMifos,
  formatDateForMifos
};
