const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');
const Tenant = require('../models/Tenant');
const ApiKey = require('../models/ApiKey');
const {
  validateApiKeyFormat,
  compareHash,
  decryptSecret
} = require('../utils/tenantSecretCrypto');

const rateLimitStore = new Map();

function getRateLimitKey(tenantId, window) {
  return `${tenantId}:${window}`;
}

function pruneRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function validateApiKeyFormatMiddleware(rawKey) {
  return validateApiKeyFormat(rawKey);
}

async function validateApiKeySecret(apiKeyRecord, providedSecret) {
  if (!providedSecret) return true;
  if (!apiKeyRecord?.secretEncrypted) return false;
  const storedSecret = decryptSecret(apiKeyRecord.secretEncrypted);
  return storedSecret === providedSecret;
}

async function checkTenantIsActive(tenantId) {
  const tenant = await Tenant.findOne({ tenantId });
  if (!tenant) {
    const error = new Error('Tenant not found');
    error.statusCode = 404;
    throw error;
  }

  if (!tenant.isOperational()) {
    const error = new Error(`Tenant is not active (status: ${tenant.status})`);
    error.statusCode = 403;
    throw error;
  }

  return tenant;
}

function checkRateLimit(tenantId, limits = {}) {
  pruneRateLimitStore();
  const now = Date.now();
  const perMinute = limits.requestsPerMinute || 60;
  const perHour = limits.requestsPerHour || 1000;

  const minuteKey = getRateLimitKey(tenantId, 'minute');
  const hourKey = getRateLimitKey(tenantId, 'hour');

  const minuteEntry = rateLimitStore.get(minuteKey) || { count: 0, resetAt: now + 60_000 };
  const hourEntry = rateLimitStore.get(hourKey) || { count: 0, resetAt: now + 3_600_000 };

  if (now > minuteEntry.resetAt) {
    minuteEntry.count = 0;
    minuteEntry.resetAt = now + 60_000;
  }
  if (now > hourEntry.resetAt) {
    hourEntry.count = 0;
    hourEntry.resetAt = now + 3_600_000;
  }

  minuteEntry.count += 1;
  hourEntry.count += 1;
  rateLimitStore.set(minuteKey, minuteEntry);
  rateLimitStore.set(hourKey, hourEntry);

  if (minuteEntry.count > perMinute || hourEntry.count > perHour) {
    const error = new Error('Rate limit exceeded for tenant');
    error.statusCode = 429;
    throw error;
  }

  return {
    minuteRemaining: Math.max(0, perMinute - minuteEntry.count),
    hourRemaining: Math.max(0, perHour - hourEntry.count)
  };
}

async function logApiAccess(req, tenantId, endpoint) {
  try {
    await AuditLog.create({
      action: 'api_call',
      description: `API access: ${req.method} ${endpoint}`,
      tenantId,
      actorType: req.authContext?.principalType === 'api_key' ? 'api_key' : 'user',
      apiKeyId: req.tenantApiKey?._id || null,
      userId: req.user?._id || req.authContext?.userId || undefined,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      resource: endpoint,
      method: req.method,
      status: 'success',
      metadata: {
        authMethod: req.tenant?.authMethod
      }
    });
  } catch (error) {
    logger.error('Failed to log API access', { error: error.message });
  }
}

async function tenantValidator(req, res, next) {
  try {
    if (!req.tenant?.tenantId) {
      return next();
    }

    await checkTenantIsActive(req.tenant.tenantId);

    const limits = req.tenantApiKey?.rateLimit || {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    };

    const rateInfo = checkRateLimit(req.tenant.tenantId, limits);
    res.set('X-RateLimit-Minute-Remaining', String(rateInfo.minuteRemaining));
    res.set('X-RateLimit-Hour-Remaining', String(rateInfo.hourRemaining));

    if (req.tenantApiKey) {
      const ip = req.ip;
      const whitelist = req.tenantApiKey.ipWhitelist || [];
      if (whitelist.length > 0 && !whitelist.includes(ip)) {
        return res.status(403).json({
          success: false,
          message: 'IP address not allowed for this API key'
        });
      }
    }

    await logApiAccess(req, req.tenant.tenantId, req.path);
    return next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Tenant validation failed'
    });
  }
}

module.exports = {
  validateApiKeyFormat: validateApiKeyFormatMiddleware,
  validateApiKeySecret,
  checkTenantIsActive,
  checkRateLimit,
  logApiAccess,
  tenantValidator,
  _rateLimitStore: rateLimitStore
};
