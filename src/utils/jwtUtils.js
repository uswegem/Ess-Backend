const logger = require('./logger');

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'emkopo-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function parseDurationToMs(duration) {
  const match = String(duration).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}

class JWTUtils {
  static getRefreshExpiresAt() {
    return new Date(Date.now() + parseDurationToMs(JWT_REFRESH_EXPIRES_IN));
  }

  static generateAccessToken(user, tenantContext = {}) {
    const payload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenantId: tenantContext.tenantId || null,
      tenantRole: tenantContext.tenantRole || null,
      permissions: tenantContext.permissions || [],
      isSuperAdmin: user.role === 'super_admin',
      tokenType: 'access'
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_ACCESS_EXPIRES_IN,
      issuer: 'emkopo-backend',
      subject: user._id.toString()
    });
  }

  static generateToken(user, tenantContext = {}) {
    return this.generateAccessToken(user, tenantContext);
  }

  static generateApiKeyToken(apiKey, tenant) {
    const payload = {
      principalType: 'api_key',
      apiKeyId: apiKey._id,
      tenantId: tenant.tenantId,
      permissions: apiKey.permissions || [],
      isSuperAdmin: false,
      tokenType: 'api_key'
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'emkopo-backend',
      subject: apiKey._id.toString()
    });
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  static decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

module.exports = JWTUtils;
