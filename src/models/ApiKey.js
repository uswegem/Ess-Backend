const mongoose = require('mongoose');
const {
  hashValue,
  compareHash,
  generateApiKey,
  generateApiSecret,
  encryptSecret,
  maskSecret
} = require('../utils/tenantSecretCrypto');

function baseApiKeyName(name) {
  return String(name || '')
    .replace(/(?: \(rotated\))+$/i, '')
    .trim() || 'API Key';
}

const apiKeySchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  keyPrefix: {
    type: String,
    required: true,
    trim: true
  },
  keyHash: {
    type: String,
    required: true,
    unique: true
  },
  secretEncrypted: {
    type: String
  },
  permissions: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired', 'disabled'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: Date,
  lastUsedAt: Date,
  lastUsedIp: String,
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  rateLimit: {
    requestsPerMinute: { type: Number, default: 60, min: 1 },
    requestsPerHour: { type: Number, default: 1000, min: 1 }
  },
  ipWhitelist: [{
    type: String,
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  revokedAt: Date,
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  revokeReason: String
}, {
  timestamps: true
});

apiKeySchema.index({ keyHash: 1 }, { unique: true });
apiKeySchema.index({ tenantId: 1, status: 1 });
apiKeySchema.index({ tenantId: 1, isActive: 1 });
apiKeySchema.index({ tenantId: 1, name: 1 });
apiKeySchema.index({ expiresAt: 1 });
apiKeySchema.index({ lastUsedAt: -1 });

apiKeySchema.pre('save', function syncActiveStatus(next) {
  if (this.isModified('status')) {
    this.isActive = this.status === 'active';
  }
  if (this.expiresAt && this.expiresAt <= new Date() && this.status === 'active') {
    this.status = 'expired';
    this.isActive = false;
  }
  next();
});

apiKeySchema.methods.verifyKey = async function verifyKey(rawKey) {
  return compareHash(rawKey, this.keyHash);
};

apiKeySchema.methods.isUsable = function isUsable() {
  if (!this.isActive || this.status !== 'active') return false;
  if (this.expiresAt && this.expiresAt <= new Date()) return false;
  return true;
};

apiKeySchema.methods.recordUsage = async function recordUsage(ipAddress) {
  this.lastUsedAt = new Date();
  this.lastUsedIp = ipAddress || this.lastUsedIp;
  this.usageCount += 1;
  return this.save();
};

apiKeySchema.methods.revoke = async function revoke(revokedBy, reason) {
  this.status = 'revoked';
  this.isActive = false;
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revokeReason = reason;
  return this.save();
};

apiKeySchema.methods.toSafeJSON = function toSafeJSON() {
  const doc = this.toObject();
  delete doc.keyHash;
  delete doc.secretEncrypted;
  doc.keyPrefix = maskSecret(doc.keyPrefix);
  return doc;
};

apiKeySchema.methods.toJSON = function toJSON() {
  return this.toSafeJSON();
};

apiKeySchema.statics.createForTenant = async function createForTenant({
  tenant,
  name,
  permissions = [],
  expiresAt = null,
  rateLimit = {},
  ipWhitelist = [],
  createdBy = null,
  keyPrefix = 'mk_live'
}) {
  const rawKey = generateApiKey(keyPrefix);
  const rawSecret = generateApiSecret();

  const apiKey = await this.create({
    tenantId: tenant.tenantId,
    tenant: tenant._id,
    name,
    keyPrefix: rawKey.slice(0, 12),
    keyHash: await hashValue(rawKey),
    secretEncrypted: encryptSecret(rawSecret),
    permissions,
    expiresAt,
    rateLimit: {
      requestsPerMinute: rateLimit.requestsPerMinute || 60,
      requestsPerHour: rateLimit.requestsPerHour || 1000
    },
    ipWhitelist,
    createdBy,
    status: 'active',
    isActive: true
  });

  return {
    apiKey,
    rawKey,
    rawSecret
  };
};

apiKeySchema.statics.findByRawKey = async function findByRawKey(rawKey) {
  const candidates = await this.find({ status: 'active', isActive: true });
  for (const candidate of candidates) {
    const match = await candidate.verifyKey(rawKey);
    if (match) return candidate;
  }
  return null;
};

apiKeySchema.statics.rotate = async function rotate(keyId, {
  revokedBy = null,
  reason = 'rotated',
} = {}) {
  const oldKey = await this.findById(keyId);
  if (!oldKey) {
    const error = new Error('API key not found');
    error.statusCode = 404;
    throw error;
  }
  if (!oldKey.isUsable()) {
    const error = new Error('API key is not active');
    error.statusCode = 400;
    throw error;
  }

  const Tenant = mongoose.model('Tenant');
  const tenant = await Tenant.findOne({ tenantId: oldKey.tenantId });
  if (!tenant) {
    const error = new Error('Tenant not found for API key');
    error.statusCode = 404;
    throw error;
  }

  const created = await this.createForTenant({
    tenant,
    name: baseApiKeyName(oldKey.name),
    permissions: oldKey.permissions,
    expiresAt: oldKey.expiresAt,
    rateLimit: oldKey.rateLimit,
    ipWhitelist: oldKey.ipWhitelist,
    createdBy: revokedBy,
    keyPrefix: oldKey.keyPrefix?.startsWith('mk_test') ? 'mk_test' : 'mk_live'
  });

  await oldKey.revoke(revokedBy, reason);

  return {
    previousKey: oldKey.toSafeJSON(),
    apiKey: created.apiKey.toSafeJSON(),
    rawKey: created.rawKey,
    rawSecret: created.rawSecret
  };
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
