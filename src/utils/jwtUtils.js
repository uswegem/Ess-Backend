const logger = require('./logger');

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'emkopo-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class JWTUtils {
  static generateToken(user, tenantContext = {}) {
    const payload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenantId: tenantContext.tenantId || null,
      tenantRole: tenantContext.tenantRole || null,
      permissions: tenantContext.permissions || [],
      isSuperAdmin: user.role === 'super_admin'
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'emkopo-backend',
      subject: user._id.toString()
    });
  }

  static generateApiKeyToken(apiKey, tenant) {
    const payload = {
      principalType: 'api_key',
      apiKeyId: apiKey._id,
      tenantId: tenant.tenantId,
      permissions: apiKey.permissions || [],
      isSuperAdmin: false
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
