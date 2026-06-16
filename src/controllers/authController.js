const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Tenant = require('../models/Tenant');
const TenantUser = require('../models/TenantUser');
const ApiKey = require('../models/ApiKey');
const RefreshToken = require('../models/RefreshToken');
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
const { logSecurityEvent } = require('../utils/securityEventLogger');

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
          correlationId: req.correlationId,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          status: 'failed',
          metadata: { username }
        });
        await logSecurityEvent({
          eventType: 'invalid_credentials',
          description: `Failed login for unknown username: ${username}`,
          req
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials.'
        });
      }

      if (!user.isActive) {
        await logSecurityEvent({
          eventType: 'deactivated_account',
          description: `Login attempt on deactivated account: ${user.username}`,
          req,
          userId: user._id
        });
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
          correlationId: req.correlationId,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          status: 'failed',
          metadata: { username: user.username }
        });
        await logSecurityEvent({
          eventType: 'invalid_credentials',
          description: `Invalid password for user: ${user.username}`,
          req,
          userId: user._id
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials.'
        });
      }

      user.lastLogin = new Date();
      await user.save();

      const { activeTenant, memberships, membership } = await resolveActiveTenantForUser(user);

      const token = JWTUtils.generateAccessToken(user, {
        tenantId: activeTenant?.tenantId || null,
        tenantRole: membership?.role || null,
        permissions: membership?.getEffectivePermissions?.() || []
      });

      const { rawToken: refreshToken } = await RefreshToken.createForUser({
        userId: user._id,
        tenantId: activeTenant?.tenantId || null,
        expiresAt: JWTUtils.getRefreshExpiresAt(),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      });

      await AuditLog.create({
        action: 'login',
        description: `User ${user.username} logged in successfully`,
        userId: user._id,
        tenantId: activeTenant?.tenantId,
        correlationId: req.correlationId,
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
          refreshToken,
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
        await logSecurityEvent({
          eventType: 'invalid_api_key',
          description: 'Invalid API key format on login',
          req
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid API key format.'
        });
      }

      const apiKey = await ApiKey.findByRawKey(rawKey);
      if (!apiKey || !apiKey.isUsable()) {
        await logSecurityEvent({
          eventType: 'invalid_api_key',
          description: 'Invalid or inactive API key on login',
          req
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid or inactive API key.'
        });
      }

      if (apiSecret && apiKey.secretEncrypted) {
        const stored = decryptSecret(apiKey.secretEncrypted);
        if (stored !== apiSecret) {
          await logSecurityEvent({
            eventType: 'invalid_api_key_secret',
            description: 'Invalid API key secret on login',
            req,
            apiKeyId: apiKey._id,
            tenantId: apiKey.tenantId,
            actorType: 'api_key'
          });
          return res.status(401).json({
            success: false,
            message: 'Invalid API key secret.'
          });
        }
      }

      const tenant = await Tenant.findOne({ tenantId: apiKey.tenantId });
      if (!tenant || !tenant.isOperational()) {
        await logSecurityEvent({
          eventType: 'tenant_inactive',
          description: 'API key login for inactive tenant',
          req,
          tenantId: apiKey.tenantId,
          actorType: 'api_key'
        });
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
        correlationId: req.correlationId,
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

      const token = JWTUtils.generateAccessToken(user, {
        tenantId: tenant.tenantId,
        tenantRole: membership.role,
        permissions: membership.getEffectivePermissions()
      });

      const { rawToken: refreshToken } = await RefreshToken.createForUser({
        userId: user._id,
        tenantId: tenant.tenantId,
        expiresAt: JWTUtils.getRefreshExpiresAt(),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      });

      await AuditLog.create({
        action: 'select_tenant',
        description: `User selected tenant: ${tenant.tenantId}`,
        userId: user._id,
        tenantId: tenant.tenantId,
        correlationId: req.correlationId,
        ipAddress: req.ip,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Tenant selected.',
        data: {
          token,
          refreshToken,
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

  static async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'refreshToken is required.'
        });
      }

      const stored = await RefreshToken.findByRawToken(refreshToken);
      if (!stored || !stored.isUsable()) {
        await logSecurityEvent({
          eventType: 'refresh_token_invalid',
          description: 'Invalid or expired refresh token',
          req
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token.'
        });
      }

      const user = await User.findById(stored.userId).select('-password');
      if (!user || !user.isActive) {
        await stored.revoke();
        return res.status(401).json({
          success: false,
          message: 'User account is not available.'
        });
      }

      let membership = null;
      let tenant = null;
      if (stored.tenantId) {
        membership = await resolveTenantMembership(user._id, stored.tenantId);
        tenant = await Tenant.findOne({ tenantId: stored.tenantId });
        if (!membership && user.role !== 'super_admin') {
          await logSecurityEvent({
            eventType: 'refresh_token_invalid',
            description: 'Refresh token tenant membership no longer valid',
            req,
            userId: user._id,
            tenantId: stored.tenantId
          });
          return res.status(403).json({
            success: false,
            message: 'Tenant membership no longer valid.'
          });
        }
      }

      const { rawToken: newRefreshToken, record: newRecord } = await RefreshToken.createForUser({
        userId: user._id,
        tenantId: stored.tenantId,
        expiresAt: JWTUtils.getRefreshExpiresAt(),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      });

      await stored.revoke(newRecord.tokenHash);

      const accessToken = JWTUtils.generateAccessToken(user, {
        tenantId: stored.tenantId,
        tenantRole: membership?.role || null,
        permissions: membership?.getEffectivePermissions?.() || []
      });

      await AuditLog.create({
        action: 'token_refresh',
        description: `Token refreshed for user ${user.username}`,
        userId: user._id,
        tenantId: stored.tenantId,
        correlationId: req.correlationId,
        ipAddress: req.ip,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Token refreshed.',
        data: {
          token: accessToken,
          refreshToken: newRefreshToken,
          activeTenant: tenant ? buildTenantContext(tenant, 'jwt') : null
        }
      });
    } catch (error) {
      logger.error('Refresh token error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Internal server error during token refresh.'
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
      await RefreshToken.revokeAllForUser(req.user._id);

      await AuditLog.create({
        action: 'logout',
        description: `User ${req.user.username} logged out`,
        userId: req.user._id,
        tenantId: req.tenant?.tenantId,
        correlationId: req.correlationId,
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
