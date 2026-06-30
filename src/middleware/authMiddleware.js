const logger = require('../utils/logger');
const JWTUtils = require('../utils/jwtUtils');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Tenant = require('../models/Tenant');
const TenantUser = require('../models/TenantUser');
const ApiKey = require('../models/ApiKey');
const {
  resolveTenantMembership,
  buildTenantContext
} = require('./tenantMiddleware');
const { logSecurityEvent } = require('../utils/securityEventLogger');

const LEGACY_TENANT_ID = () => process.env.LEGACY_TENANT_ID || 'legacy-zedone';

const TENANT_ADMIN_ROLES = ['tenant_admin', 'operations_manager', 'finance_officer', 'support_staff'];
const PLATFORM_ADMIN_ROLES = ['super_admin', 'admin'];

function isPlatformAdminUser(user) {
  return PLATFORM_ADMIN_ROLES.includes(user?.role);
}

const PLATFORM_SWITCHER_PERMISSIONS = [
  'tenant:read',
  'tenant:update',
  'users:manage',
  'api_keys:manage',
  'dashboard:read',
  'audit:read'
];

async function resolveSwitcherTenants(user) {
  if (isPlatformAdminUser(user)) {
    const tenants = await Tenant.find({ status: 'active' }).sort({ tenantName: 1 }).lean();
    return tenants.map((t) => ({
      tenantId: t.tenantId,
      tenantName: t.tenantName,
      fspCode: t.fspCode,
      role: 'platform',
      isActive: true
    }));
  }

  const memberships = await TenantUser.findActiveTenantsForUser(user._id);
  return memberships.map((m) => ({
    tenantId: m.tenantId,
    tenantName: m.tenant?.tenantName,
    fspCode: m.tenant?.fspCode,
    role: m.role,
    permissions: m.getEffectivePermissions(),
    isActive: m.isActive
  }));
}

function buildAuthContext({ user, decoded, apiKey, membership }) {
  if (apiKey) {
    return {
      principalType: 'api_key',
      userId: null,
      apiKeyId: apiKey._id,
      role: 'api_key',
      permissions: apiKey.permissions || [],
      isSuperAdmin: false
    };
  }

  return {
    principalType: 'user',
    userId: user?._id || decoded?.userId,
    apiKeyId: null,
    role: membership?.role || decoded?.tenantRole || user?.role,
    permissions: membership?.getEffectivePermissions?.() || decoded?.permissions || [],
    isSuperAdmin: user?.role === 'super_admin' || decoded?.isSuperAdmin === true
  };
}

async function resolveActiveTenantForUser(user) {
  const switcherTenants = await resolveSwitcherTenants(user);

  if (isPlatformAdminUser(user)) {
    let activeTenantDoc = await Tenant.findOne({ tenantId: LEGACY_TENANT_ID() });
    if (!activeTenantDoc && switcherTenants.length > 0) {
      activeTenantDoc = await Tenant.findOne({ tenantId: switcherTenants[0].tenantId });
    }
    return {
      activeTenant: activeTenantDoc ? buildTenantContext(activeTenantDoc, 'jwt') : null,
      memberships: switcherTenants,
      membership: null
    };
  }

  const memberships = await TenantUser.findActiveTenantsForUser(user._id);

  if (memberships.length === 0) {
    return { activeTenant: null, memberships: [], membership: null };
  }

  const primary = memberships[0];
  const tenant = primary.tenant;

  return {
    activeTenant: tenant ? buildTenantContext(tenant, 'jwt') : null,
    memberships: switcherTenants,
    membership: primary
  };
}

async function resolveApiKeyFromJwt(decoded) {
  const apiKey = await ApiKey.findById(decoded.apiKeyId);
  if (!apiKey || !apiKey.isUsable()) {
    return null;
  }
  const tenant = await Tenant.findOne({ tenantId: decoded.tenantId || apiKey.tenantId });
  if (!tenant || !tenant.isOperational()) {
    return null;
  }
  return { apiKey, tenant };
}

const authMiddleware = async (req, res, next) => {
  try {
    const apiKeyHeader = req.header('X-Tenant-Key');
    if (apiKeyHeader && req.tenantApiKey) {
      req.authContext = buildAuthContext({ apiKey: req.tenantApiKey });
      return next();
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = JWTUtils.verifyToken(token);

    if (decoded.principalType === 'api_key' && decoded.apiKeyId) {
      const resolved = await resolveApiKeyFromJwt(decoded);
      if (!resolved) {
        await logSecurityEvent({
          eventType: 'invalid_api_key',
          description: 'Invalid or expired API key JWT',
          req,
          actorType: 'api_key',
          metadata: { apiKeyId: decoded.apiKeyId }
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired API key token.'
        });
      }

      req.tenantApiKey = resolved.apiKey;
      req.tenant = buildTenantContext(resolved.tenant, 'api_key');
      req.tokenPayload = decoded;
      req.authContext = buildAuthContext({ apiKey: resolved.apiKey });
      return next();
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      await logSecurityEvent({
        eventType: 'invalid_jwt',
        description: 'JWT references unknown user',
        req,
        metadata: { userId: decoded.userId }
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      await logSecurityEvent({
        eventType: 'deactivated_account',
        description: `Deactivated account access attempt: ${user.username}`,
        req,
        userId: user._id
      });
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    let membership = null;
    if (decoded.tenantId) {
      membership = await resolveTenantMembership(user._id, decoded.tenantId);
      if (!membership && !isPlatformAdminUser(user)) {
        await logSecurityEvent({
          eventType: 'permission_denied',
          description: `No tenant membership for ${decoded.tenantId}`,
          req,
          userId: user._id,
          tenantId: decoded.tenantId
        });
        return res.status(403).json({
          success: false,
          message: 'No active membership for selected tenant.'
        });
      }
    }

    req.user = user;
    req.tokenPayload = decoded;
    req.authContext = buildAuthContext({ user, decoded, membership });

    if (decoded.tenantId && req.tenant?.tenantId !== decoded.tenantId) {
      const tenant = await Tenant.findOne({ tenantId: decoded.tenantId });
      if (tenant) {
        req.tenant = buildTenantContext(tenant, 'jwt');
      }
    }

    next();
  } catch (error) {
    await logSecurityEvent({
      eventType: 'invalid_jwt',
      description: 'Invalid or expired JWT',
      req,
      metadata: { error: error.message }
    });
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user && !req.tenantApiKey && req.authContext?.principalType !== 'api_key') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (req.authContext?.isSuperAdmin) {
      return next();
    }

    const candidateRoles = [
      req.user?.role,
      req.authContext?.role,
      req.tenantApiKey ? 'api_key' : null
    ].filter(Boolean);

    if (candidateRoles.some((role) => roles.includes(role))) {
      return next();
    }

    logSecurityEvent({
      eventType: 'permission_denied',
      description: `Role denied. Required: ${roles.join(', ')}`,
      req,
      userId: req.user?._id,
      metadata: { candidateRoles, requiredRoles: roles }
    }).catch(() => {});

    return res.status(403).json({
      success: false,
      message: 'Access denied. Insufficient permissions.'
    });
  };
};

const permissionMiddleware = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.authContext) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (req.authContext.isSuperAdmin || req.user?.role === 'admin') {
      return next();
    }

    const granted = req.authContext.permissions || [];
    const hasAll = requiredPermissions.every((permission) => granted.includes(permission));

    if (!hasAll) {
      logSecurityEvent({
        eventType: 'permission_denied',
        description: `Permission denied. Required: ${requiredPermissions.join(', ')}`,
        req,
        userId: req.user?._id,
        metadata: { requiredPermissions, granted }
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        message: 'Access denied. Missing required permissions.'
      });
    }

    return next();
  };
};

const platformOrPermissionMiddleware = (...requiredPermissions) => permissionMiddleware(...requiredPermissions);

const auditMiddleware = async (req, res, next) => {
  const originalSend = res.send;

  res.send = function(data) {
    const contentType = res.get('Content-Type');
    const result = originalSend.call(this, data);

    if (req.user || req.tenantApiKey) {
      const auditLog = new AuditLog({
        action: getActionFromRoute(req),
        description: `${req.authContext?.principalType || 'user'} performed ${req.method} on ${req.path}`,
        userId: req.user?._id,
        tenantId: req.tenant?.tenantId,
        tenant: req.tenant?.tenantObjectId,
        actorType: req.authContext?.principalType || 'user',
        apiKeyId: req.tenantApiKey?._id,
        correlationId: req.correlationId,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip || req.connection?.remoteAddress,
        resource: req.path,
        method: req.method,
        status: res.statusCode >= 400 ? 'failed' : 'success',
        metadata: {
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          contentType
        }
      });

      auditLog.save().catch((err) => logger.error('Error saving audit log', { error: err.message }));
    }

    return result;
  };

  next();
};

function getActionFromRoute(req) {
  const path = req.path;
  const method = req.method;

  if (path.includes('/auth/login')) return 'login';
  if (path.includes('/auth/logout')) return 'logout';
  if (path.includes('/auth/refresh')) return 'token_refresh';
  if (path.includes('/auth/select-tenant')) return 'select_tenant';
  if (path.includes('/api-keys') && method === 'POST' && path.includes('/rotate')) return 'api_key_rotate';
  if (path.includes('/api-keys') && method === 'POST') return 'api_key_create';
  if (path.includes('/api-keys') && method === 'DELETE') return 'api_key_revoke';
  if (path.includes('/tenants') && method === 'POST' && !path.includes('/users') && !path.includes('/api-keys')) return 'tenant_create';
  if (path.includes('/tenants') && method === 'PUT' && !path.includes('/users')) return 'tenant_update';
  if (path.includes('/status') && method === 'PATCH') return 'tenant_status_change';
  if (path.includes('/onboarding') && path.includes('/submit')) return 'onboarding_submit';
  if (path.includes('/onboarding') && path.includes('/review')) return 'onboarding_review';
  if (path.includes('/tenants') && path.includes('/users') && method === 'POST') return 'tenant_user_create';
  if (path.includes('/users') && method === 'POST') return 'create_user';
  if (path.includes('/users') && method === 'PUT') return 'update_user';
  if (path.includes('/users') && method === 'DELETE') return 'delete_user';
  if (path.includes('/products') && method === 'POST') return 'system_event';
  if (path.includes('/emkopo')) return 'api_call';

  return 'system_event';
}

module.exports = {
  authMiddleware,
  roleMiddleware,
  permissionMiddleware,
  platformOrPermissionMiddleware,
  auditMiddleware,
  buildAuthContext,
  resolveActiveTenantForUser,
  resolveSwitcherTenants,
  isPlatformAdminUser,
  PLATFORM_ADMIN_ROLES,
  PLATFORM_SWITCHER_PERMISSIONS,
  TENANT_ADMIN_ROLES
};
