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
  'ESS_CALLBACK_URL',
  'JWT_EXPIRES_IN',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'REDIS_URL',
  'IPSEC_TUNNEL_INTERFACE',
  'STRONGSWAN_CONF_PATH',
  'TENANT_SECRET_ENCRYPTION_KEY',
  'LEGACY_TENANT_ID',
  'TENANT_ENFORCEMENT',
  'CBS_TIMEOUT_MS',
  'API_TIMEOUT',
  'SKIP_MIFOS_ACTIVATION_CHECK',
  'RUNTIME_PROVISIONING_ENABLED',
  'RUNTIME_PROVISIONING_ALLOWED_HOSTS',
  'RUNTIME_SSH_HOST',
  'RUNTIME_SSH_USER',
  'RUNTIME_SSH_KEY_PATH'
];

// Required only when the runtime-provisioning feature is actually enabled —
// checked separately below rather than unconditionally, since not every
// deployment provisions tenants against a runtime host. Provisioning is
// triggered by SSH-invoking the runtime host's own provision_tenant.sh
// (restricted to a forced command on that end) — not a direct DB
// connection, so no database credentials live in this app's config at all.
const runtimeProvisioningEnvVars = ['RUNTIME_SSH_HOST', 'RUNTIME_SSH_USER', 'RUNTIME_SSH_KEY_PATH'];

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

  // Runtime-provisioning (SSH-triggering provision_tenant.sh on the
  // separate runtime host) is opt-in per deployment. When enabled, fail
  // closed rather than silently skipping SSH config validation.
  if (process.env.RUNTIME_PROVISIONING_ENABLED === 'true') {
    const missingRuntime = runtimeProvisioningEnvVars.filter((key) => !process.env[key]);
    if (missingRuntime.length > 0) {
      const errorMsg = `❌ RUNTIME_PROVISIONING_ENABLED=true but missing required runtime-host variables: ${missingRuntime.join(', ')}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
  
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
  
  const fileFields = ['PRIVATE_KEY_PATH', 'CERTIFICATE_PATH', 'RUNTIME_SSH_KEY_PATH'];
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

  if (process.env.NODE_ENV !== 'test' && !process.env.TENANT_SECRET_ENCRYPTION_KEY) {
    logger.warn('⚠️ TENANT_SECRET_ENCRYPTION_KEY is not set — tenant secret encryption will be unavailable');
  }

  if (!process.env.LEGACY_TENANT_ID) {
    process.env.LEGACY_TENANT_ID = 'legacy-zedone';
  }

  if (process.env.TENANT_ENFORCEMENT === undefined) {
    process.env.TENANT_ENFORCEMENT = process.env.NODE_ENV === 'production' ? 'true' : 'false';
  }

  if (process.env.THIRD_PARTY_BASE_URL && !process.env.UTUMISHI_ENDPOINT) {
    logger.warn('⚠️ THIRD_PARTY_BASE_URL is deprecated — set UTUMISHI_ENDPOINT instead');
  }
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
    legacyTenantId: process.env.LEGACY_TENANT_ID || 'legacy-zedone',
    tenantEnforcement: process.env.TENANT_ENFORCEMENT || 'false',
    runtimeProvisioningEnabled: process.env.RUNTIME_PROVISIONING_ENABLED === 'true',
    runtimeProvisioningAllowedHosts: process.env.RUNTIME_PROVISIONING_ALLOWED_HOSTS || 'localhost,127.0.0.1,102.204.1.22',
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
