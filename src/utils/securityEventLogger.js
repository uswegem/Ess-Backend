const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

const SECURITY_EVENT_TYPES = [
  'invalid_api_key',
  'invalid_api_key_secret',
  'invalid_jwt',
  'deactivated_account',
  'rate_limit_exceeded',
  'ip_whitelist_rejected',
  'fsp_code_mismatch',
  'permission_denied',
  'tenant_inactive',
  'invalid_credentials',
  'refresh_token_invalid',
  'refresh_token_reuse'
];

async function logSecurityEvent({
  eventType,
  description,
  req = null,
  tenantId = null,
  userId = null,
  apiKeyId = null,
  actorType = 'system',
  status = 'failed',
  metadata = {}
}) {
  if (!SECURITY_EVENT_TYPES.includes(eventType)) {
    logger.warn('Unknown security event type', { eventType });
  }

  const payload = {
    action: 'security_event',
    description: description || `Security event: ${eventType}`,
    tenantId: tenantId || req?.tenant?.tenantId || null,
    tenant: req?.tenant?.tenantObjectId || null,
    actorType,
    apiKeyId: apiKeyId || req?.tenantApiKey?._id || null,
    userId: userId || req?.user?._id || req?.authContext?.userId || undefined,
    userAgent: req?.get?.('User-Agent'),
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    resource: req?.path,
    method: req?.method,
    correlationId: req?.correlationId,
    status,
    metadata: {
      eventType,
      ...metadata
    }
  };

  try {
    await AuditLog.create(payload);
  } catch (error) {
    logger.error('Failed to persist security event', {
      eventType,
      error: error.message
    });
  }
}

module.exports = {
  logSecurityEvent,
  SECURITY_EVENT_TYPES
};
