const ApiKey = require('../models/ApiKey');
const Tenant = require('../models/Tenant');
const AuditLog = require('../models/AuditLog');
const { authMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');
const { logSecurityEvent } = require('../utils/securityEventLogger');

class ApiKeyController {
  static async listKeys(req, res) {
    try {
      const { tenantId } = req.params;
      if (req.tenant?.tenantId && req.tenant.tenantId !== tenantId && !req.authContext?.isSuperAdmin) {
        return res.status(403).json({ success: false, message: 'Tenant mismatch.' });
      }

      const keys = await ApiKey.find({ tenantId }).sort({ createdAt: -1 });
      res.json({
        success: true,
        data: { apiKeys: keys.map((k) => k.toSafeJSON()) }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createKey(req, res) {
    try {
      const { tenantId } = req.params;
      const { name, permissions = [], expiresAt, rateLimit, ipWhitelist, keyPrefix } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'name is required.' });
      }

      const tenant = await Tenant.findOne({ tenantId });
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found.' });
      }

      const created = await ApiKey.createForTenant({
        tenant,
        name,
        permissions,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        rateLimit,
        ipWhitelist,
        createdBy: req.user?._id,
        keyPrefix: keyPrefix || 'mk_live'
      });

      await AuditLog.create({
        action: 'api_key_create',
        description: `API key created: ${name}`,
        tenantId,
        tenant: tenant._id,
        userId: req.user?._id,
        correlationId: req.correlationId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        status: 'success',
        metadata: { apiKeyId: created.apiKey._id }
      });

      res.status(201).json({
        success: true,
        message: 'API key created. Store the raw key and secret securely — they are shown only once.',
        data: {
          apiKey: created.apiKey.toSafeJSON(),
          rawKey: created.rawKey,
          rawSecret: created.rawSecret
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async revokeKey(req, res) {
    try {
      const { tenantId, keyId } = req.params;
      const { reason } = req.body;

      const apiKey = await ApiKey.findOne({ _id: keyId, tenantId });
      if (!apiKey) {
        return res.status(404).json({ success: false, message: 'API key not found.' });
      }

      await apiKey.revoke(req.user?._id, reason || 'revoked by admin');

      await AuditLog.create({
        action: 'api_key_revoke',
        description: `API key revoked: ${apiKey.name}`,
        tenantId,
        userId: req.user?._id,
        correlationId: req.correlationId,
        ipAddress: req.ip,
        status: 'success',
        metadata: { apiKeyId: apiKey._id, reason }
      });

      res.json({ success: true, message: 'API key revoked.', data: { apiKey: apiKey.toSafeJSON() } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async rotateKey(req, res) {
    try {
      const { tenantId, keyId } = req.params;
      const { reason } = req.body;

      const apiKey = await ApiKey.findOne({ _id: keyId, tenantId });
      if (!apiKey) {
        return res.status(404).json({ success: false, message: 'API key not found.' });
      }

      const result = await ApiKey.rotate(keyId, {
        revokedBy: req.user?._id,
        reason: reason || 'rotated by admin'
      });

      await AuditLog.create({
        action: 'api_key_rotate',
        description: `API key rotated: ${apiKey.name}`,
        tenantId,
        userId: req.user?._id,
        correlationId: req.correlationId,
        ipAddress: req.ip,
        status: 'success',
        metadata: { previousKeyId: keyId, newKeyId: result.apiKey._id }
      });

      res.json({
        success: true,
        message: 'API key rotated. Update consumers with the new credentials.',
        data: result
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}

module.exports = ApiKeyController;
