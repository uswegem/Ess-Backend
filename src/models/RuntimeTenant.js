const mongoose = require('mongoose');

const runtimeTenantSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  tenantName: {
    type: String,
    required: true,
    trim: true,
  },
  databaseName: {
    type: String,
    required: true,
    trim: true,
  },
  schemaName: {
    type: String,
    required: true,
    trim: true,
  },
  runtimeHost: {
    type: String,
    default: '102.204.1.22',
  },
  runtimePort: {
    type: Number,
    default: 3002,
  },
  status: {
    type: String,
    enum: ['provisioned', 'bootstrapping', 'active', 'failed'],
    default: 'provisioned',
  },
  bootstrapStatus: {
    type: String,
    enum: ['pending', 'running', 'complete', 'failed'],
    default: 'pending',
  },
  provisionedAt: {
    type: Date,
    default: Date.now,
  },
  bootstrapStartedAt: Date,
  bootstrapCompletedAt: Date,
  activatedAt: Date,
  appConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  notificationConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  adminUser: {
    username: String,
    email: String,
    passwordHash: String,
    createdAt: Date,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('RuntimeTenant', runtimeTenantSchema);
