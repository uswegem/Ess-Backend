const Tenant = require('../models/Tenant');
const { getEffectiveConfig, getTokenForTenant } = require('./mifosTenantClient');

class MifosConfigError extends Error {
  constructor(message, code = 'MIFOS_CONFIG_ERROR') {
    super(message);
    this.code = code;
    this.statusCode = 400;
  }
}

async function saveMifosConfig(tenant, payload, updatedBy) {
  const mode = payload.mode || tenant.mifosConfig?.mode || 'inherit_default';
  tenant.mifosConfig = tenant.mifosConfig || {};

  tenant.mifosConfig.mode = mode;

  if (mode === 'override') {
    tenant.mifosConfig.baseUrl = payload.baseUrl;
    tenant.mifosConfig.tenantId = payload.tenantId;
    tenant.mifosConfig.makerUsername = payload.makerUsername;
    tenant.mifosConfig.checkerUsername = payload.checkerUsername;
    if (payload.makerPassword) {
      tenant.mifosConfig.makerPasswordEncrypted = payload.makerPassword;
    }
    if (payload.checkerPassword) {
      tenant.mifosConfig.checkerPasswordEncrypted = payload.checkerPassword;
    }
    tenant.mifosConfig.callbackUrl = payload.callbackUrl || tenant.mifosConfig.callbackUrl;
    if (payload.timeoutMs) tenant.mifosConfig.timeoutMs = payload.timeoutMs;
  }

  tenant.mifosConfig.isConfigured = mode === 'inherit_default' || Boolean(tenant.mifosConfig.baseUrl);
  if (updatedBy) tenant.updatedBy = updatedBy;

  await tenant.save();
  return tenant;
}

async function validateMifosConfig(tenant) {
  const config = getEffectiveConfig(tenant);
  const checkedAt = new Date();

  if (!config.baseUrl || !config.tenantId) {
    return { valid: false, checkedAt, message: 'MIFOS baseUrl and tenantId are required' };
  }

  if (process.env.NODE_ENV === 'test') {
    const valid = isMifosConfigured(tenant);
    tenant.mifosConfig = tenant.mifosConfig || {};
    tenant.mifosConfig.lastValidatedAt = checkedAt;
    tenant.mifosConfig.isConfigured = valid;
    await tenant.save();
    return { valid, checkedAt };
  }

  try {
    await getTokenForTenant(tenant, 'maker');
    tenant.mifosConfig = tenant.mifosConfig || {};
    tenant.mifosConfig.lastValidatedAt = checkedAt;
    tenant.mifosConfig.isConfigured = true;
    await tenant.save();
    return { valid: true, checkedAt };
  } catch (error) {
    return { valid: false, checkedAt, message: error.message };
  }
}

async function assertReadyForActivation(tenant) {
  const result = await validateMifosConfig(tenant);
  if (!result.valid) {
    throw new MifosConfigError(result.message || 'MIFOS configuration is not valid');
  }
  return true;
}

function isMifosConfigured(tenant) {
  const mode = tenant.mifosConfig?.mode || 'inherit_default';
  if (mode === 'inherit_default') {
    return Boolean(process.env.CBS_BASE_URL && process.env.CBS_Tenant);
  }
  return Boolean(tenant.mifosConfig?.isConfigured && tenant.mifosConfig?.baseUrl);
}

module.exports = {
  MifosConfigError,
  saveMifosConfig,
  validateMifosConfig,
  assertReadyForActivation,
  isMifosConfigured
};
