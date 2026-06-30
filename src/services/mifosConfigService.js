const Tenant = require('../models/Tenant');
const {
  getEffectiveConfig,
  getTokenForTenant,
  formatMifosAuthError,
  normalizeMifosBaseUrl,
  clearTenantTokenCache
} = require('./mifosTenantClient');

class MifosConfigError extends Error {
  constructor(message, code = 'MIFOS_CONFIG_ERROR') {
    super(message);
    this.name = 'MifosConfigError';
    this.code = code;
    this.statusCode = 400;
  }
}

function normalizeMifosPayload(payload = {}) {
  const normalized = { ...payload };

  if (normalized.mode !== 'override') {
    return normalized;
  }

  normalized.baseUrl = normalizeMifosBaseUrl(normalized.baseUrl);
  normalized.makerUsername = normalized.makerUsername || normalized.username;
  normalized.makerPassword = normalized.makerPassword || normalized.password;
  normalized.checkerUsername = normalized.checkerUsername || normalized.makerUsername;
  normalized.checkerPassword = normalized.checkerPassword || normalized.makerPassword;

  delete normalized.username;
  delete normalized.password;

  return normalized;
}

async function saveMifosConfig(tenant, payload, updatedBy) {
  const normalized = normalizeMifosPayload(payload);
  const mode = normalized.mode || tenant.mifosConfig?.mode || 'inherit_default';
  tenant.mifosConfig = tenant.mifosConfig || {};

  tenant.mifosConfig.mode = mode;

  if (mode === 'override') {
    tenant.mifosConfig.baseUrl = normalized.baseUrl;
    tenant.mifosConfig.tenantId = normalized.tenantId;
    tenant.mifosConfig.makerUsername = normalized.makerUsername;
    tenant.mifosConfig.checkerUsername = normalized.checkerUsername;
    if (normalized.makerPassword) {
      tenant.mifosConfig.makerPasswordEncrypted = normalized.makerPassword;
    }
    if (normalized.checkerPassword) {
      tenant.mifosConfig.checkerPasswordEncrypted = normalized.checkerPassword;
    }
    tenant.mifosConfig.callbackUrl = normalized.callbackUrl || tenant.mifosConfig.callbackUrl;
    if (normalized.timeoutMs) tenant.mifosConfig.timeoutMs = normalized.timeoutMs;
  } else {
    clearTenantTokenCache(tenant.tenantId);
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
    clearTenantTokenCache(tenant?.tenantId);
    await getTokenForTenant(tenant, 'maker');
    tenant.mifosConfig = tenant.mifosConfig || {};
    tenant.mifosConfig.lastValidatedAt = checkedAt;
    tenant.mifosConfig.isConfigured = true;
    await tenant.save();
    return { valid: true, checkedAt };
  } catch (error) {
    return { valid: false, checkedAt, message: formatMifosAuthError(error) };
  }
}

async function assertReadyForActivation(tenant) {
  if (process.env.SKIP_MIFOS_ACTIVATION_CHECK === 'true') {
    return true;
  }

  const result = await validateMifosConfig(tenant);
  if (!result.valid) {
    throw new MifosConfigError(
      result.message || 'MIFOS configuration is not valid. Cannot activate tenant until CBS credentials are verified.'
    );
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
  normalizeMifosPayload,
  saveMifosConfig,
  validateMifosConfig,
  assertReadyForActivation,
  isMifosConfigured
};
