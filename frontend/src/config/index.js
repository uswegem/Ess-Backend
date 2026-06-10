/**
 * Environment Configuration for MiraCore Admin Portal
 */

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// API Configuration
export const API_CONFIG = {
  // ESS Backend API URL via Admin Portal Proxy
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://5.75.185.137/api/v1',
  
  // Request timeout
  TIMEOUT: parseInt(process.env.REACT_APP_API_TIMEOUT) || 30000,
  
  // Enable request/response logging in development
  DEBUG: isDevelopment,
};

// Authentication Configuration
export const AUTH_CONFIG = {
  TOKEN_KEY: 'mira_admin_token',
  USER_KEY: 'mira_admin_user',
  REFRESH_TOKEN_KEY: 'mira_admin_refresh_token',
  TOKEN_HEADER: 'Authorization',
  TOKEN_PREFIX: 'Bearer ',
  
  // Session timeout (7 days default)
  SESSION_TIMEOUT: parseInt(process.env.REACT_APP_SESSION_TIMEOUT) || 7 * 24 * 60 * 60 * 1000,
};

// Application Configuration
export const APP_CONFIG = {
  NAME: 'MiraCore Admin Portal',
  VERSION: process.env.REACT_APP_VERSION || '1.0.0',
  
  // Features flags
  FEATURES: {
    EXPORT_ENABLED: process.env.REACT_APP_EXPORT_ENABLED !== 'false',
    ADVANCED_FILTERING: process.env.REACT_APP_ADVANCED_FILTERING !== 'false',
    REAL_TIME_UPDATES: process.env.REACT_APP_REAL_TIME_UPDATES === 'true',
  },
  
  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE_SIZE: parseInt(process.env.REACT_APP_DEFAULT_PAGE_SIZE) || 20,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  },
  
  // Date/Time formatting
  DATE_FORMAT: 'YYYY-MM-DD',
  DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss',
  TIMEZONE: 'Africa/Dar_es_Salaam',
};

// Server Configuration (for display/monitoring)
export const SERVER_CONFIG = {
  ESS_BACKEND: {
    HOST: '135.181.33.13',
    PORT: 3002,
    URL: 'http://135.181.33.13:3002'
  },
  
  MIFOS_CBS: {
    HOST: 'zedone-uat.miracore.co.tz',
    URL: 'https://zedone-uat.miracore.co.tz/fineract-provider/api'
  },
  
  ADMIN_PORTAL: {
    HOST: '5.75.185.137',
    URL: 'http://5.75.185.137'
  }
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  UNAUTHORIZED: 'Session expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back! Login successful.',
  LOGOUT_SUCCESS: 'You have been successfully logged out.',
  DATA_SAVED: 'Data saved successfully.',
  DATA_DELETED: 'Data deleted successfully.',
  EXPORT_SUCCESS: 'Data exported successfully.',
};

// Status mappings for loans
export const LOAN_STATUS = {
  INITIAL_OFFER: {
    label: 'Initial Offer',
    color: 'blue',
    description: 'Loan offer created, awaiting employee response'
  },
  APPROVED: {
    label: 'Approved',
    color: 'green',
    description: 'Loan approved by system, awaiting final approval'
  },
  FINAL_APPROVAL_RECEIVED: {
    label: 'Final Approval',
    color: 'green', 
    description: 'Final approval received, ready for disbursement'
  },
  CLIENT_CREATED: {
    label: 'Client Created',
    color: 'blue',
    description: 'Client created in MIFOS system'
  },
  LOAN_CREATED: {
    label: 'Loan Created',
    color: 'blue',
    description: 'Loan application created in MIFOS'
  },
  DISBURSED: {
    label: 'Disbursed',
    color: 'green',
    description: 'Loan amount disbursed to employee'
  },
  COMPLETED: {
    label: 'Completed',
    color: 'green',
    description: 'Loan fully repaid and closed'
  },
  WAITING_FOR_LIQUIDATION: {
    label: 'Awaiting Liquidation',
    color: 'orange',
    description: 'Loan takeover - waiting for liquidation of existing loan'
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'red',
    description: 'Loan cancelled by employee or system'
  },
  REJECTED: {
    label: 'Rejected',
    color: 'red',
    description: 'Loan application rejected'
  },
  FAILED: {
    label: 'Failed',
    color: 'red',
    description: 'Loan processing failed due to technical error'
  }
};

// Export all configs
export default {
  API_CONFIG,
  AUTH_CONFIG,
  APP_CONFIG,
  SERVER_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LOAN_STATUS
};