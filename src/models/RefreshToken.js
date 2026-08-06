const mongoose = require('mongoose');
const crypto = require('crypto');
const { hashValue, compareHash } = require('../utils/tenantSecretCrypto');

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  tenantId: {
    type: String,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  revokedAt: Date,
  replacedByTokenHash: String,
  userAgent: String,
  ipAddress: String
}, {
  timestamps: true
});

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

refreshTokenSchema.methods.isUsable = function isUsable() {
  if (this.revokedAt) return false;
  return this.expiresAt > new Date();
};

refreshTokenSchema.methods.revoke = async function revoke(replacedByTokenHash = null) {
  this.revokedAt = new Date();
  if (replacedByTokenHash) {
    this.replacedByTokenHash = replacedByTokenHash;
  }
  return this.save();
};

refreshTokenSchema.statics.generateRawToken = function generateRawToken() {
  return crypto.randomBytes(48).toString('hex');
};

refreshTokenSchema.statics.createForUser = async function createForUser({
  userId,
  tenantId = null,
  expiresAt,
  userAgent = null,
  ipAddress = null
}) {
  const rawToken = this.generateRawToken();
  const record = await this.create({
    userId,
    tenantId,
    tokenHash: await hashValue(rawToken),
    expiresAt,
    userAgent,
    ipAddress
  });

  return { record, rawToken };
};

refreshTokenSchema.statics.findByRawToken = async function findByRawToken(rawToken) {
  const candidates = await this.find({
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 }).limit(200);

  for (const candidate of candidates) {
    const match = await compareHash(rawToken, candidate.tokenHash);
    if (match) return candidate;
  }
  return null;
};

refreshTokenSchema.statics.revokeAllForUser = async function revokeAllForUser(userId) {
  return this.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
