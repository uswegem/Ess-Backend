const logger = require('../utils/logger');

/**
 * Environment Variable Validation
 * Validates all required environment variables are present before server starts
 */

const requiredEnvVars = [
  'CBS_BASE_URL',
  'CBS_Tenant',
  'CBS_MAKER_USERNAME',
  'CBS_MAKER_PASSWORD',
  'CBS_CHECKER_USERNAME',
  'CBS_CHECKER_PASSWORD',
  'MONGODB_URI',
  'JWT_SECRET',
  'FSP_NAME',
  'FSP_CODE',
  'PRIVATE_KEY_PATH',
  'CERTIFICATE_PATH',
  'UTUMISHI_ENDPOINT'
];

const optionalEnvVars = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'THIRD_PARTY_BASE_URL',
  'ESS_CALLBACK_URL',
  'JWT_EXPIRES_IN',
  'REDIS_URL',
  'IPSEC_TUNNEL_INTERFACE',
  'STRONGSWAN_CONF_PATH'
];

/**
 * Validate that all required environment variables are present
 * @throws {Error} If any required environment variable is missing
 */
function validateEnvironment() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    const errorMsg = `❌ Missing required environment variables: ${missing.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  logger.info('✅ All required environment variables present');
  
  // Log optional variables status (for debugging)
  const presentOptional = optionalEnvVars.filter(key => process.env[key]);
  const missingOptional = optionalEnvVars.filter(key => !process.env[key]);
  
  if (presentOptional.length > 0) {
    logger.info(`Optional variables present: ${presentOptional.join(', ')}`);
  }
  
  if (missingOptional.length > 0) {
    logger.info(`Optional variables using defaults: ${missingOptional.join(', ')}`);
  }
}

/**
 * Validate specific environment variable patterns
 * @throws {Error} If validation fails
 */
function validateEnvPatterns() {
  // Validate URLs
  const urlFields = ['CBS_BASE_URL', 'MONGODB_URI', 'UTUMISHI_ENDPOINT'];
  urlFields.forEach(field => {
    if (process.env[field] && !process.env[field].startsWith('http')) {
      logger.warn(`${field} should start with http:// or https://`);
    }
  });
  
  // Validate JWT_SECRET is not default in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'emkopo-super-secret-key-change-in-production') {
      const errorMsg = '❌ SECURITY: JWT_SECRET must be changed in production!';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Ensure JWT_SECRET is strong enough (at least 32 characters)
    if (process.env.JWT_SECRET.length < 32) {
      logger.warn('⚠️ JWT_SECRET should be at least 32 characters for security');
    }
  }
  
  // Validate file paths exist
  const fs = require('fs');
  const path = require('path');
  
  const fileFields = ['PRIVATE_KEY_PATH', 'CERTIFICATE_PATH'];
  fileFields.forEach(field => {
    if (process.env[field]) {
      const filePath = path.resolve(process.env[field]);
      try {
        if (!fs.existsSync(filePath)) {
          logger.warn(`⚠️ ${field} file not found: ${filePath}`);
        } else {
          logger.info(`✅ ${field} verified: ${filePath}`);
        }
      } catch (error) {
        logger.warn(`⚠️ Could not verify ${field}: ${error.message}`);
      }
    }
  });
  
  logger.info('✅ Environment pattern validation complete');
}

/**
 * Log environment configuration (sanitized)
 */
function logEnvironmentConfig() {
  logger.info('Environment Configuration:', {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3002,
    fspName: process.env.FSP_NAME,
    fspCode: process.env.FSP_CODE,
    cbsTenant: process.env.CBS_Tenant,
    logLevel: process.env.LOG_LEVEL || 'info',
    // Never log sensitive values like passwords, secrets, or keys
  });
}

module.exports = {
  validateEnvironment,
  validateEnvPatterns,
  logEnvironmentConfig,
  requiredEnvVars,
  optionalEnvVars
};
