const logger = require('./logger');

// Loan Service Constants and Default Values
const LOAN_CONSTANTS = {
  // ===== LOAN AMOUNTS =====
  DEFAULT_LOAN_AMOUNT: 5000000,        // 5,000,000 TZS - Default loan amount when not specified
  MAX_LOAN_AMOUNT: 120000000,          // 120,000,000 TZS - Maximum eligible loan amount
  MIN_LOAN_AMOUNT: 100000,             // 100,000 TZS - Minimum eligible loan amount
  TEST_LOAN_AMOUNT: 5000000,           // 5,000,000 TZS - Amount used in tests

  // ===== LOAN TERMS =====
  DEFAULT_TENURE: 96,                  // 96 months - Default loan tenure
  MAX_TENURE: 96,                     // 96 months - Maximum loan tenure
  TEST_TENURE: 24,                     // 24 months - Tenure used in tests

  // ===== INTEREST RATES & FEES =====
  DEFAULT_INTEREST_RATE: 24,           // 24% - Default annual interest rate
  ADMIN_FEE_RATE: 0.02,                // 2% - Administration fee rate
  INSURANCE_RATE: 0.015,               // 1.5% - Insurance rate
  OTHER_CHARGES: 50000,                // 50,000 TZS - Fixed other charges (legal fees, etc.)
  TOTAL_LOAN_MULTIPLIER: 1.1,          // 110% - Total loan amount multiplier (principal + interest)

  // ===== NPA AND RISK CONSTANTS =====
  NPA_LOAN_ARR_DAYS: 90,               // 90 days - Days in arrears for NPA classification

  // ===== SALARY AND DEDUCTION DEFAULTS =====
  TEST_BASIC_SALARY: 2000000,          // 2,000,000 TZS - Test basic salary
  TEST_NET_SALARY: 1800000,            // 1,800,000 TZS - Test net salary
  TEST_ONE_THIRD_AMOUNT: 600000,       // 600,000 TZS - Test 1/3 of basic salary
  TEST_DEDUCTIBLE_AMOUNT: 500000,      // 500,000 TZS - Test desired monthly deduction
  TEST_TOTAL_EMPLOYEE_DEDUCTION: 200000, // 200,000 TZS - Test total employee deductions

  // ===== FSP AND SYSTEM IDENTIFIERS =====
  FSP_CODE: 'FL8090',                  // Financial Service Provider code
  FSP_NAME: 'ZE DONE',                 // Financial Service Provider name
  EXTERNAL_SYSTEM: 'ESS_UTUMISHI',     // External salary system name

  // ===== DEFAULT DATES =====
  DEFAULT_DATE_OF_BIRTH: '1990-01-01', // Default date of birth for testing
  TEST_RETIREMENT_DATE: '2055-12-31', // Far future retirement date for testing

  // ===== DATE FORMATS =====
  RESPONSE_DATE_FORMAT: "yyyy-MM-dd'T'HH:mm:ss",
  YEAR_MONTH_DAY_FORMAT: "yyyy-MM-dd",

  // ===== CLOSURE NOTE IDS =====
  notifiableClosureNoteIds: [1, 4, 5, 7, 8],
  cancellationClosureNoteId: 5,

  // ===== AFFORDABILITY TYPES =====
  AFFORDABILITY_TYPE: {
    REVERSE: 'REVERSE',
    FORWARD: 'FORWARD'
  },

  // ===== ERROR CODES =====
  ERROR_CODES: {
    NOT_ELIGIBLE: '8014',       // "Invalid code, mismatch of supplied code on information and header"
    INTERNAL_ERROR: '8012',     // "Request cannot be completed at this time, try later"
    INVALID_REQUEST: '8001'     // "Required header is not given"
  },

  // ===== TEST IDENTIFIERS =====
  TEST_CHECK_NUMBER: 'CHK123456',
  TEST_CLIENT_ID: 12345,
  TEST_LOAN_ID: 67890,
  TEST_ACCOUNT_NO: 'LN000123',
  TEST_LOAN_ALIAS: 'LOAN67890'
};

module.exports = LOAN_CONSTANTS;