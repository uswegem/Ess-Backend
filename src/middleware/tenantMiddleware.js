const logger = require('../utils/logger');
const Tenant = require('../models/Tenant');
const ApiKey = require('../models/ApiKey');
const TenantUser = require('../models/TenantUser');
const JWTUtils = require('../utils/jwtUtils');
const { decryptSecret, validateApiKeyFormat } = require('../utils/tenantSecretCrypto');
const LOAN_CONSTANTS = require('../utils/loanConstants');

const LEGACY_TENANT_ID = () => process.env.LEGACY_TENANT_ID || 'legacy-zedone';
const isEnforcementEnabled = () => process.env.TENANT_ENFORCEMENT === 'true';

// Keep in sync with PLATFORM_ADMIN_ROLES in middleware/authMiddleware.js. Duplicated
// here (rather than imported) to avoid a circular require - authMiddleware.js already
// requires this file.
const PLATFORM_ADMIN_ROLES = ['super_admin', 'admin'];

function isPlatformAdminToken(decoded) {
  if (!decoded) return false;
  return PLATFORM_ADMIN_ROLES.includes(decoded.role) || decoded.isSuperAdmin === true;
}

const PUBLIC_PATH_PREFIXES = [
  '/health',
  '/metrics',
  '/api-docs',
  '/api-docs.json',
  '/api/v1/auth/login',
  '/api/auth/login',
  '/api/v1/auth/login-with-api-key',
  '/api/auth/login-with-api-key',
  '/api/v1/auth/refresh'
];

const TENANT_OPTIONAL_PREFIXES = [
  '/api/v1/tenants',
  '/api/v1/onboarding'
];

// Server-to-server routes called directly by external systems (e.g. ESS UTUMISHI)
// that have no way to present a tenant API key or JWT. These always resolve to
// the legacy tenant, regardless of TENANT_ENFORCEMENT, instead of 403ing.
const LEGACY_FALLBACK_ALWAYS_PREFIXES = [
  '/api/loan'
];

function isPublicRoute(req) {
  const path = req.path || '';
  return PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isTenantOptionalRoute(req) {
  const path = req.path || '';
  return TENANT_OPTIONAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isLegacyFallbackAlwaysRoute(req) {
  const path = req.path || '';
  return LEGACY_FALLBACK_ALWAYS_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function buildTenantContext(tenant, authMethod) {
  return {
    tenantId: tenant.tenantId,
    tenantObjectId: tenant._id,
    fspCode: tenant.fspCode,
    fspName: tenant.fspName,
    status: tenant.status,
    subscriptionPlan: tenant.subscription?.plan || 'standard',
    maxTenureMonths: tenant.loanConfig?.maxTenureMonths || LOAN_CONSTANTS.MAX_TENURE,
    authMethod
  };
}

async function extractTenantFromToken(req) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return null;

  // Verify the signature once and keep `decoded` around even if tenant
  // resolution below fails - callers need the verified claims (e.g. to check
  // for a platform-admin bypass) regardless of whether a tenant was found.
  let decoded;
  try {
    decoded = JWTUtils.verifyToken(token);
  } catch {
    return null;
  }

  if (!decoded.tenantId) return { tenant: null, decoded };

  const tenant = await Tenant.findOne({ tenantId: decoded.tenantId });
  if (!tenant) return { tenant: null, decoded };

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

    if (!tenantContext && (!isEnforcementEnabled() || isLegacyFallbackAlwaysRoute(req))) {
      tenantContext = await attachLegacyTenant();
      if (tenantContext) {
        logger.debug('Attached legacy tenant for backward compatibility', {
          tenantId: tenantContext.tenantId,
          route: req.path
        });
      }
    }

    if (!tenantContext) {
      if (isTenantOptionalRoute(req)) {
        return next();
      }

      // Platform admins (super_admin/admin) must not be hard-blocked here just because
      // no tenant could be resolved (e.g. a token minted with no active tenant selected).
      // This only skips the "tenant required" 403 - it grants no permissions or role
      // elevation itself. req.tenant stays null; every downstream consumer already
      // handles that (isPlatformAdminUser/isSuperAdmin-aware fallbacks), and authMiddleware
      // still independently re-verifies the user against the DB and applies the real
      // permission/role checks exactly as it does today.
      if (isPlatformAdminToken(tokenPayload)) {
        logger.debug('Platform admin bypassing tenant-required check', {
          userId: tokenPayload.userId,
          route: req.path
        });
        req.tenant = null;
        req.tenantApiKey = null;
        req.tokenPayload = tokenPayload;
        return next();
      }

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
  isTenantOptionalRoute,
  isLegacyFallbackAlwaysRoute,
  extractTenantFromToken,
  extractTenantFromApiKey,
  attachTenantToRequest,
  validateTenantSubscription,
  buildTenantContext,
  resolveTenantMembership,
  attachLegacyTenant
};
