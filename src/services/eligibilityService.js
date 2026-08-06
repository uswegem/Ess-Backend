const LOAN_CONSTANTS = require('../utils/loanConstants');
const { ApplicationException } = require('../utils/loanUtils');
const logger = require('../utils/logger');
const LoanCalculations = require('../utils/loanCalculations');

// Mock Eligibility Service
class EligibilityService {
  /**
   * Check if customer is active in CBS
   */
  async isActiveCBSCustomer(country, customerNumber) {
    // Mock implementation - in real scenario, this would call CBS API
    logger.info(`Checking if customer ${customerNumber} is active in CBS for ${country}`);

    // For demo purposes, assume customer is active
    // In real implementation, this would validate against CBS
    return true;
  }

  /**
   * Get loan offer from eligibility engine
   */
  async getOffer(loanOfferDTO, isPossibleCharges = false) {
    logger.info('Getting loan offer from eligibility service:', loanOfferDTO);

    try {
      const requestedAmount = loanOfferDTO.loanAmount || LOAN_CONSTANTS.DEFAULT_LOAN_AMOUNT;
      const tenure = loanOfferDTO.tenure || LOAN_CONSTANTS.DEFAULT_TENURE;
      const affordabilityType = loanOfferDTO.affordabilityType || 'FORWARD';

      // Extract product parameters with fallback to constants
      const productDetails = loanOfferDTO.productDetails || {};
      const interestRate = productDetails.interestRate || LOAN_CONSTANTS.DEFAULT_INTEREST_RATE;
      const maxPrincipal = productDetails.maxPrincipal || LOAN_CONSTANTS.MAX_LOAN_AMOUNT;
      const minPrincipal = productDetails.minPrincipal || LOAN_CONSTANTS.MIN_LOAN_AMOUNT;
      const maxTenure = productDetails.maxNumberOfRepayments || LOAN_CONSTANTS.MAX_TENURE;
      
      // Validate against minimum loan amount
      if (loanOfferDTO.requestedAmount && loanOfferDTO.requestedAmount < minPrincipal) {
        throw new ApplicationException(
          'LOAN_AMOUNT_TOO_LOW',
          `Requested amount ${loanOfferDTO.requestedAmount} is below minimum ${minPrincipal}`
        );
      }

      logger.info('Using product parameters:', {
        interestRate,
        maxPrincipal,
        minPrincipal,
        maxTenure,
        source: productDetails.interestRate ? 'MIFOS' : 'CONSTANTS'
      });

      let adjustedLoanAmount;
      let calculatedEMI;

      if (affordabilityType === 'REVERSE') {
        // For reverse calculation: use centralRegAffordability as target EMI
        const targetEMI = loanOfferDTO.centralRegAffordability;
        logger.info(`Reverse calculation: Using ${targetEMI} as target EMI`);
        // Calculate minimum EMI required for MIN_LOAN_AMOUNT
        const minEMI = await LoanCalculations.calculateEMI(LOAN_CONSTANTS.MIN_LOAN_AMOUNT, interestRate, tenure);
        const effectiveEMI = Math.max(targetEMI, minEMI);
        logger.info(`Min required EMI: ${minEMI}, Using effective EMI: ${effectiveEMI}`);
        adjustedLoanAmount = this.calculateMaxLoanAmount(effectiveEMI, interestRate, tenure);
        calculatedEMI = effectiveEMI;
        logger.info(`Calculated max loan amount: ${adjustedLoanAmount} for EMI: ${calculatedEMI}`);
      } else {
        // For forward calculation: check if requested amount fits within affordability
        const maxAffordableEMI = loanOfferDTO.centralRegAffordability || await LoanCalculations.calculateEMI(requestedAmount, interestRate, tenure);

        // Calculate EMI for requested amount
        calculatedEMI = await LoanCalculations.calculateEMI(requestedAmount, interestRate, tenure);

        // If calculated EMI exceeds maximum affordable EMI, adjust the loan amount
        adjustedLoanAmount = requestedAmount;
        if (calculatedEMI > maxAffordableEMI) {
          logger.info(`Calculated EMI ${calculatedEMI} exceeds max affordable EMI ${maxAffordableEMI}, adjusting loan amount`);
          // Calculate maximum loan amount that fits within maxAffordableEMI
          adjustedLoanAmount = this.calculateMaxLoanAmount(maxAffordableEMI, interestRate, tenure);
          calculatedEMI = maxAffordableEMI;
          logger.info(`Adjusted loan amount from ${requestedAmount} to ${adjustedLoanAmount} to fit EMI constraint`);
        } else {
          logger.info(`Requested amount ${requestedAmount} fits within affordability (EMI: ${calculatedEMI})`);
        }
      }

        // Mock eligibility response using dynamic product parameters
      // Ensure loan amount is not less than minimum principal
      adjustedLoanAmount = Math.max(adjustedLoanAmount, minPrincipal);

      // Ensure all values are valid numbers (not NaN or undefined)
      const safeCalculatedEMI = isNaN(calculatedEMI) || !calculatedEMI ? 0 : Number(calculatedEMI);
      const safeAdjustedLoanAmount = isNaN(adjustedLoanAmount) || !adjustedLoanAmount ? 0 : Number(adjustedLoanAmount);
      const safeTenure = isNaN(tenure) || !tenure ? LOAN_CONSTANTS.DEFAULT_TENURE : Number(tenure);
      
      // Calculate total interest amount safely
      const totalInterest = (safeCalculatedEMI * safeTenure) - safeAdjustedLoanAmount;
      const safeTotalInterest = isNaN(totalInterest) || totalInterest < 0 ? 0 : totalInterest;

      const mockOffer = {
        loanOffer: {
          product: {
            loanTerm: safeTenure,
            totalMonthlyInst: safeCalculatedEMI,
            loanAmount: safeAdjustedLoanAmount,
            totalLoanAmount: safeAdjustedLoanAmount * (productDetails.totalLoanMultiplier || LOAN_CONSTANTS.TOTAL_LOAN_MULTIPLIER), // with interest
            maximumAmount: maxPrincipal,
            maximumTerm: maxTenure
          },
          totalInterestAmount: safeTotalInterest,
          adminFee: safeAdjustedLoanAmount * (productDetails.adminFeeRate || LOAN_CONSTANTS.ADMIN_FEE_RATE),
          insurance: {
            oneTimeAmount: safeAdjustedLoanAmount * (productDetails.insuranceRate || LOAN_CONSTANTS.INSURANCE_RATE)
          },
          bpi: 0, // Bank Processing Fee
          maxEligibleAmount: maxPrincipal,
          maxEligibleTerm: maxTenure,
          baseTotalLoanAmount: safeAdjustedLoanAmount * (productDetails.totalLoanMultiplier || LOAN_CONSTANTS.TOTAL_LOAN_MULTIPLIER)
        }
      };

      return mockOffer;
    } catch (error) {
      logger.error('Error getting offer from eligibility service:', error);
      throw new ApplicationException(LOAN_CONSTANTS.ERROR_CODES.INTERNAL_ERROR, 'Eligibility service error');
    }
  }

  /**
   * Calculate maximum loan amount for a given EMI, interest rate, and tenure
   * @deprecated Use LoanCalculations.calculateMaxLoanFromEMI instead
   */
  calculateMaxLoanAmount(targetEMI, annualInterestRate, tenureMonths) {
    // Delegate to centralized utility
    return LoanCalculations.calculateMaxLoanFromEMI(targetEMI, annualInterestRate, tenureMonths);
  }
}

module.exports = new EligibilityService();