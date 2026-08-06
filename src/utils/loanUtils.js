const logger = require('./logger');

const { format } = require('date-fns');
const LOAN_CONSTANTS = require('./loanConstants');

// Improved date handling with fallback
const { differenceInMonths, parseISO } = (() => {
  try {
    const df = require('date-fns');
    return { differenceInMonths: df.differenceInMonths, parseISO: df.parseISO };
  } catch (e) {
    return {
      parseISO: (s) => new Date(s),
      differenceInMonths: (later, earlier) => {
        const yDiff = later.getFullYear() - earlier.getFullYear();
        const mDiff = later.getMonth() - earlier.getMonth();
        return yDiff * 12 + mDiff;
      }
    };
  }
})();

/**
 * Format date to Utumishi format
 */
function formattedToUtumishiDate(dateString, isEndOfDay = false) {
  try {
    const date = new Date(dateString);
    if (isEndOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    return format(date, "yyyy-MM-dd'T'HH:mm:ss");
  } catch (error) {
    logger.error("Invalid utumishi date-format, given date:", dateString, "error:", error);
    return "";
  }
}

/**
 * Construct full name from components
 */
function constructName(firstName, middleName, lastName) {
  const parts = [firstName, middleName, lastName].filter(name => name && name.trim());
  return parts.join(' ') || '';
}

/**
 * Validate retirement age and adjust tenure
 */
function validateRetirementAge(tenure, retirementMonthsLeft, options = {}) {
  const maxTenure = options.maxTenure || LOAN_CONSTANTS.MAX_TENURE || 240;
  let t = parseInt(tenure || 0, 10);
  if (!t || t <= 0) t = LOAN_CONSTANTS.DEFAULT_TENURE || maxTenure;
  if (typeof retirementMonthsLeft === 'number' && retirementMonthsLeft > 0) {
    t = Math.min(t, retirementMonthsLeft, maxTenure);
  } else {
    t = Math.min(t, maxTenure);
  }
  return Math.max(0, t);
}

/**
 * Calculate months until retirement
 */
function calculateMonthsUntilRetirement(retirementInput) {
  if (!retirementInput && retirementInput !== 0) {
    return 1000; // Large number if unknown
  }
  if (typeof retirementInput === 'number' || /^\d+$/.test(String(retirementInput))) {
    const n = parseInt(retirementInput, 10);
    if (!isNaN(n)) {
      return Math.max(0, n);
    }
  }
  try {
    const dt = parseISO(String(retirementInput));
    const now = new Date();
    const months = differenceInMonths(dt, now);
    return Math.max(0, months);
  } catch (e) {
    return 1000;
  }
}

/**
 * Safe parse float
 */
function safeParseFloat(v, defaultValue = 0) {
  if (v === null || v === undefined || v === '') return defaultValue;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * Custom Application Exception class
 */
class ApplicationException extends Error {
  constructor(errorCode, errorMsg) {
    super(errorMsg);
    this.errorCode = errorCode;
    this.errorMsg = errorMsg;
    this.name = 'ApplicationException';
  }
}

/**
 * Generate a unique loan number
 * @returns {string} Generated loan number
 */
function generateLoanNumber() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `LOAN${timestamp}${random}`;
}

/**
 * Generate a unique FSP reference number
 * @returns {string} Generated FSP reference number
 */
function generateFSPReferenceNumber() {
    const timestamp = Date.now().toString();
    return `FSP${timestamp}`;
}

module.exports = {
  formattedToUtumishiDate,
  constructName,
  validateRetirementAge,
  calculateMonthsUntilRetirement,
  safeParseFloat,
  ApplicationException,
  generateLoanNumber,
  generateFSPReferenceNumber,
  LOAN_CONSTANTS
};