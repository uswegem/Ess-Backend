const logger = require('../utils/logger');
const Tenant = require('../models/Tenant');
const ApiKey = require('../models/ApiKey');
const TenantUser = require('../models/TenantUser');
const JWTUtils = require('../utils/jwtUtils');
const { decryptSecret, validateApiKeyFormat } = require('../utils/tenantSecretCrypto');

const LEGACY_TENANT_ID = () => process.env.LEGACY_TENANT_ID || 'legacy-zedone';
const isEnforcementEnabled = () => process.env.TENANT_ENFORCEMENT === 'true';

const PUBLIC_PATH_PREFIXES = [
  '/health',
  '/metrics',
  '/api-docs',
  '/api-docs.json',
  '/api/v1/auth/login',
  '/api/auth/login',
  '/api/v1/auth/login-with-api-key',
  '/api/auth/login-with-api-key'
];

function isPublicRoute(req) {
  const path = req.path || '';
  return PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function buildTenantContext(tenant, authMethod) {
  return {
    tenantId: tenant.tenantId,
    tenantObjectId: tenant._id,
    fspCode: tenant.fspCode,
    fspName: tenant.fspName,
    status: tenant.status,
    subscriptionPlan: tenant.subscription?.plan || 'standard',
    authMethod
  };
}

async function extractTenantFromToken(req) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const decoded = JWTUtils.verifyToken(token);
  if (!decoded.tenantId) return null;

  const tenant = await Tenant.findOne({ tenantId: decoded.tenantId });
  if (!tenant) return null;

  return {
    tenant: buildTenantContext(tenant, 'jwt'),
    decoded
  };
}

async function extractTenantFromApiKey(req) {
  const headerKey = req.header('X-Tenant-Key');
  const bodyKey = req.body?.apiKey;
  const rawKey = headerKey || bodyKey;
  if (!rawKey) return null;

  if (!validateApiKeyFormat(rawKey)) {
    const error = new Error('Invalid API key format');
    error.statusCode = 401;
    throw error;
  }

  const apiKey = await ApiKey.findByRawKey(rawKey);
  if (!apiKey || !apiKey.isUsable()) {
    const error = new Error('Invalid or inactive API key');
    error.statusCode = 401;
    throw error;
  }

  const apiSecret = req.header('X-Tenant-Secret') || req.body?.apiSecret;
  if (apiSecret && apiKey.secretEncrypted) {
    const storedSecret = decryptSecret(apiKey.secretEncrypted);
    if (storedSecret !== apiSecret) {
      const error = new Error('Invalid API key secret');
      error.statusCode = 401;
      throw error;
    }
  }

  const tenant = await Tenant.findOne({ tenantId: apiKey.tenantId });
  if (!tenant) {
    const error = new Error('Tenant not found for API key');
    error.statusCode = 401;
    throw error;
  }

  await apiKey.recordUsage(req.ip);

  return {
    tenant: buildTenantContext(tenant, 'api_key'),
    apiKey
  };
}

async function attachLegacyTenant() {
  const tenant = await Tenant.findOne({ tenantId: LEGACY_TENANT_ID() });
  if (!tenant) return null;
  return buildTenantContext(tenant, 'legacy');
}

async function validateTenantSubscription(tenantContext) {
  if (!tenantContext) {
    const error = new Error('Tenant context missing');
    error.statusCode = 403;
    throw error;
  }

  const blockedStatuses = ['suspended', 'disabled', 'rejected'];
  if (blockedStatuses.includes(tenantContext.status)) {
    const error = new Error(`Tenant is ${tenantContext.status}`);
    error.statusCode = 403;
    throw error;
  }

  if (!['active', 'approved'].includes(tenantContext.status)) {
    const error = new Error(`Tenant is not operational (status: ${tenantContext.status})`);
    error.statusCode = 403;
    throw error;
  }
}

async function attachTenantToRequest(req, res, next) {
  try {
    if (isPublicRoute(req)) {
      return next();
    }

    let tenantContext = null;
    let apiKeyRecord = null;
    let tokenPayload = null;

    const fromApiKey = await extractTenantFromApiKey(req);
    if (fromApiKey) {
      tenantContext = fromApiKey.tenant;
      apiKeyRecord = fromApiKey.apiKey;
    } else {
      const fromToken = await extractTenantFromToken(req);
      if (fromToken) {
        tenantContext = fromToken.tenant;
        tokenPayload = fromToken.decoded;
      }
    }

    if (!tenantContext && !isEnforcementEnabled()) {
      tenantContext = await attachLegacyTenant();
      if (tenantContext) {
        logger.debug('Attached legacy tenant for backward compatibility', {
          tenantId: tenantContext.tenantId
        });
      }
    }

    if (!tenantContext) {
      return res.status(403).json({
        success: false,
        message: 'Tenant context could not be resolved'
      });
    }

    await validateTenantSubscription(tenantContext);

    req.tenant = tenantContext;
    req.tenantApiKey = apiKeyRecord || null;
    req.tokenPayload = tokenPayload || null;

  } catch (error) {
    logger.warn('Tenant middleware error', { error: error.message });
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Tenant resolution failed'
    });
  }

  return next();
}

async function resolveTenantMembership(userId, tenantId) {
  return TenantUser.findActiveMembership(userId, tenantId);
}

module.exports = {
  isPublicRoute,
  extractTenantFromToken,
  extractTenantFromApiKey,
  attachTenantToRequest,
  validateTenantSubscription,
  buildTenantContext,
  resolveTenantMembership,
  attachLegacyTenant
};
