const axios = require('axios');
const Tenant = require('../models/Tenant');

function getPlatformMifosConfig() {
  return {
    mode: 'inherit_default',
    baseUrl: process.env.CBS_BASE_URL,
    tenantId: process.env.CBS_Tenant,
    makerUsername: process.env.CBS_MAKER_USERNAME,
    makerPassword: process.env.CBS_MAKER_PASSWORD,
    checkerUsername: process.env.CBS_CHECKER_USERNAME,
    checkerPassword: process.env.CBS_CHECKER_PASSWORD,
    timeoutMs: parseInt(process.env.CBS_TIMEOUT_MS || '30000', 10)
  };
}

function getEffectiveConfig(tenant) {
  if (!tenant) {
    return getPlatformMifosConfig();
  }

  const mode = tenant.mifosConfig?.mode || 'inherit_default';
  if (mode === 'inherit_default') {
    return getPlatformMifosConfig();
  }

  return {
    mode: 'override',
    baseUrl: tenant.mifosConfig.baseUrl,
    tenantId: tenant.mifosConfig.tenantId,
    makerUsername: tenant.mifosConfig.makerUsername,
    makerPassword: tenant.getMakerPassword?.() || null,
    checkerUsername: tenant.mifosConfig.checkerUsername,
    checkerPassword: tenant.getCheckerPassword?.() || null,
    callbackUrl: tenant.mifosConfig.callbackUrl,
    timeoutMs: tenant.mifosConfig.timeoutMs || 30000
  };
}

const tokenCache = new Map();

function cacheKey(tenantId, userType) {
  return `${tenantId}:${userType}`;
}

async function fetchToken(config, userType = 'maker') {
  const credentials = userType === 'maker'
    ? { username: config.makerUsername, password: config.makerPassword }
    : { username: config.checkerUsername, password: config.checkerPassword };

  if (!config.baseUrl || !config.tenantId || !credentials.username || !credentials.password) {
    throw new Error('Incomplete MIFOS configuration');
  }

  const response = await axios.post(
    `${config.baseUrl.replace(/\/$/, '')}/v1/authentication`,
    credentials,
    {
      headers: {
        'Content-Type': 'application/json',
        'fineract-platform-tenantid': config.tenantId
      },
      timeout: config.timeoutMs || 30000
    }
  );

  if (response.status !== 200 || !response.data.base64EncodedAuthenticationKey) {
    throw new Error('Invalid MIFOS authentication response');
  }

  return response.data.base64EncodedAuthenticationKey;
}

async function getTokenForTenant(tenant, userType = 'maker') {
  const tenantKey = tenant?.tenantId || 'platform';
  const key = cacheKey(tenantKey, userType);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const config = getEffectiveConfig(tenant);
  const token = await fetchToken(config, userType);
  tokenCache.set(key, { token, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
  return token;
}

async function getAuthHeaderForTenant(tenant, userType = 'maker') {
  const token = await getTokenForTenant(tenant, userType);
  return { Authorization: `Basic ${token}` };
}

function getAxiosClientForTenant(tenant) {
  const config = getEffectiveConfig(tenant);
  return axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeoutMs || 30000,
    headers: {
      'Fineract-Platform-TenantId': config.tenantId
    },
    auth: config.mode === 'inherit_default' ? {
      username: config.makerUsername,
      password: config.makerPassword
    } : undefined
  });
}

function clearTenantTokenCache(tenantId) {
  if (tenantId) {
    tokenCache.delete(cacheKey(tenantId, 'maker'));
    tokenCache.delete(cacheKey(tenantId, 'checker'));
  } else {
    tokenCache.clear();
  }
}

function useTenantMifos() {
  return process.env.USE_TENANT_MIFOS !== 'false';
}

function resolveTenantForMifos(req) {
  if (!useTenantMifos()) {
    return null;
  }
  if (req?.tenant?.tenantObjectId) {
    return Tenant.findById(req.tenant.tenantObjectId);
  }
  if (req?.tenant?.tenantId) {
    return Tenant.findOne({ tenantId: req.tenant.tenantId });
  }
  return null;
}

module.exports = {
  getPlatformMifosConfig,
  getEffectiveConfig,
  getTokenForTenant,
  getAuthHeaderForTenant,
  getAxiosClientForTenant,
  clearTenantTokenCache,
  useTenantMifos,
  resolveTenantForMifos
};
