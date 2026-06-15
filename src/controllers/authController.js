const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Tenant = require('../models/Tenant');
const TenantUser = require('../models/TenantUser');
const ApiKey = require('../models/ApiKey');
const JWTUtils = require('../utils/jwtUtils');
const logger = require('../utils/logger');
const {
  buildTenantContext,
  resolveTenantMembership
} = require('../middleware/tenantMiddleware');
const {
  validateApiKeyFormat,
  decryptSecret
} = require('../utils/tenantSecretCrypto');
const { resolveActiveTenantForUser } = require('../middleware/authMiddleware');

const LEGACY_TENANT_ID = () => process.env.LEGACY_TENANT_ID || 'legacy-zedone';

class AuthController {
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required.'
        });
      }

      const user = await User.findOne({
        $or: [
          { username: username.toLowerCase() },
          { email: username.toLowerCase() }
        ]
      });

      if (!user) {
        await AuditLog.create({
          action: 'login',
          description: `Failed login attempt for username: ${username}`,
          userId: null,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          status: 'failed',
          metadata: { username }
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials.'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact administrator.'
        });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await AuditLog.create({
          action: 'login',
          description: `Failed login attempt for user: ${user.username}`,
          userId: user._id,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          status: 'failed',
          metadata: { username: user.username }
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials.'
        });
      }

      user.lastLogin = new Date();
      await user.save();

      const { activeTenant, memberships, membership } = await resolveActiveTenantForUser(user);

      const token = JWTUtils.generateToken(user, {
        tenantId: activeTenant?.tenantId || null,
        tenantRole: membership?.role || null,
        permissions: membership?.getEffectivePermissions?.() || []
      });

      await AuditLog.create({
        action: 'login',
        description: `User ${user.username} logged in successfully`,
        userId: user._id,
        tenantId: activeTenant?.tenantId,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success',
        metadata: { role: user.role, tenantId: activeTenant?.tenantId }
      });

      res.json({
        success: true,
        message: 'Login successful.',
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            lastLogin: user.lastLogin
          },
          activeTenant: activeTenant || null,
          memberships,
          permissions: membership?.getEffectivePermissions?.() || []
        }
      });
    } catch (error) {
      logger.error('Login error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Internal server error during login.'
      });
    }
  }

  static async loginWithApiKey(req, res) {
    try {
      const rawKey = req.header('X-Tenant-Key') || req.body?.apiKey;
      const apiSecret = req.header('X-Tenant-Secret') || req.body?.apiSecret;

      if (!rawKey) {
        return res.status(400).json({
          success: false,
          message: 'API key is required (X-Tenant-Key header or apiKey body field).'
        });
      }

      if (!validateApiKeyFormat(rawKey)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key format.'
        });
      }

      const apiKey = await ApiKey.findByRawKey(rawKey);
      if (!apiKey || !apiKey.isUsable()) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or inactive API key.'
        });
      }

      if (apiSecret && apiKey.secretEncrypted) {
        const stored = decryptSecret(apiKey.secretEncrypted);
        if (stored !== apiSecret) {
          return res.status(401).json({
            success: false,
            message: 'Invalid API key secret.'
          });
        }
      }

      const tenant = await Tenant.findOne({ tenantId: apiKey.tenantId });
      if (!tenant || !tenant.isOperational()) {
        return res.status(403).json({
          success: false,
          message: 'Tenant is not active.'
        });
      }

      await apiKey.recordUsage(req.ip);

      const token = JWTUtils.generateApiKeyToken(apiKey, tenant);
      const tenantContext = buildTenantContext(tenant, 'api_key');

      await AuditLog.create({
        action: 'login',
        description: `API key login: ${apiKey.name}`,
        tenantId: tenant.tenantId,
        tenant: tenant._id,
        actorType: 'api_key',
        apiKeyId: apiKey._id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'API key authentication successful.',
        data: {
          token,
          tenant: tenantContext,
          permissions: apiKey.permissions || [],
          apiKey: apiKey.toSafeJSON()
        }
      });
    } catch (error) {
      logger.error('API key login error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Internal server error during API key login.'
      });
    }
  }

  static async selectTenant(req, res) {
    try {
      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId is required.'
        });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      const tenant = await Tenant.findOne({ tenantId });
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found.'
        });
      }

      let membership = await resolveTenantMembership(user._id, tenantId);
      if (!membership && user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this tenant.'
        });
      }

      if (!membership && user.role === 'super_admin') {
        membership = {
          role: 'tenant_admin',
          getEffectivePermissions: () => ['tenant:read', 'tenant:update', 'users:manage', 'dashboard:read']
        };
      }

      const token = JWTUtils.generateToken(user, {
        tenantId: tenant.tenantId,
        tenantRole: membership.role,
        permissions: membership.getEffectivePermissions()
      });

      res.json({
        success: true,
        message: 'Tenant selected.',
        data: {
          token,
          activeTenant: buildTenantContext(tenant, 'jwt'),
          permissions: membership.getEffectivePermissions()
        }
      });
    } catch (error) {
      logger.error('Select tenant error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Internal server error.'
      });
    }
  }

  static async getProfile(req, res) {
    try {
      const { memberships } = await resolveActiveTenantForUser(req.user);

      res.json({
        success: true,
        data: {
          user: req.user,
          tenants: memberships,
          activeTenant: req.tenant || null,
          authContext: req.authContext || null
        }
      });
    } catch (error) {
      logger.error('Get profile error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Internal server error.'
      });
    }
  }

  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect.'
        });
      }

      user.password = newPassword;
      await user.save();

      await AuditLog.create({
        action: 'update_user',
        description: `User ${user.username} changed password`,
        userId: user._id,
        tenantId: req.tenant?.tenantId,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Password changed successfully.'
      });
    } catch (error) {
      logger.error('Change password error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Internal server error.'
      });
    }
  }

  static async logout(req, res) {
    try {
      await AuditLog.create({
        action: 'logout',
        description: `User ${req.user.username} logged out`,
        userId: req.user._id,
        tenantId: req.tenant?.tenantId,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Logout successful.'
      });
    } catch (error) {
      logger.error('Logout error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout.'
      });
    }
  }
}

module.exports = AuthController;
