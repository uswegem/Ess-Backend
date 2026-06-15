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
const { tenantValidator } = require('./tenantValidator');

const LEGACY_TENANT_ID = () => process.env.LEGACY_TENANT_ID || 'legacy-zedone';

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
  const memberships = await TenantUser.findActiveTenantsForUser(user._id);

  if (memberships.length === 0 && user.role === 'super_admin') {
    const legacy = await Tenant.findOne({ tenantId: LEGACY_TENANT_ID() });
    if (legacy) {
      return {
        activeTenant: buildTenantContext(legacy, 'jwt'),
        memberships: [],
        membership: null
      };
    }
  }

  if (memberships.length === 0) {
    return { activeTenant: null, memberships: [], membership: null };
  }

  const primary = memberships[0];
  const tenant = primary.tenant;

  return {
    activeTenant: tenant ? buildTenantContext(tenant, 'jwt') : null,
    memberships: memberships.map((m) => ({
      tenantId: m.tenantId,
      tenantName: m.tenant?.tenantName,
      fspCode: m.tenant?.fspCode,
      role: m.role,
      permissions: m.getEffectivePermissions(),
      isActive: m.isActive
    })),
    membership: primary
  };
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
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    let membership = null;
    if (decoded.tenantId) {
      membership = await resolveTenantMembership(user._id, decoded.tenantId);
      if (!membership && user.role !== 'super_admin') {
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
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user && !req.tenantApiKey) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const role = req.user?.role || req.authContext?.role;
    if (!roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

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
  if (path.includes('/users') && method === 'POST') return 'create_user';
  if (path.includes('/users') && method === 'PUT') return 'update_user';
  if (path.includes('/users') && method === 'DELETE') return 'delete_user';
  if (path.includes('/emkopo')) return 'api_call';

  return 'system_event';
}

module.exports = {
  authMiddleware,
  roleMiddleware,
  auditMiddleware,
  buildAuthContext,
  resolveActiveTenantForUser
};
