const mongoose = require('mongoose');
const { isAllowedRuntimeHost } = require('../utils/runtimeHostSecurity');

const provisioningTenantSchema = new mongoose.Schema({
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
    maxlength: 200,
  },
  runtimeHost: {
    type: String,
    required: true,
    trim: true,
    // Reject hosts outside the runtime-provisioning allowlist at write time —
    // don't rely solely on the outbound client's call-time check.
    validate: {
      validator: (value) => isAllowedRuntimeHost(String(value).replace(/^https?:\/\//, '')),
      message: (props) => `Runtime host '${props.value}' is not on the runtime-provisioning allowlist.`,
    },
  },
  runtimePort: {
    type: Number,
    default: 3002,
    min: 1,
    max: 65535,
  },
  databaseName: {
    type: String,
    trim: true,
  },
  schemaName: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['draft', 'provisioning', 'ready', 'failed', 'inactive'],
    default: 'provisioning',
  },
  appConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  notificationConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  provisioningJob: {
    jobId: { type: String },
    status: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    lastError: { type: String },
  },
  bootstrap: {
    status: { type: String, default: 'not_started' },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    databaseCreated: { type: Boolean, default: false },
    schemaApplied: { type: Boolean, default: false },
    adminUserCreated: { type: Boolean, default: false },
    adminUsername: { type: String },
    lastError: { type: String },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

provisioningTenantSchema.index({ status: 1, createdAt: -1 });

provisioningTenantSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  return {
    id: obj._id,
    tenantId: obj.tenantId,
    tenantName: obj.tenantName,
    runtimeHost: obj.runtimeHost,
    runtimePort: obj.runtimePort,
    databaseName: obj.databaseName,
    schemaName: obj.schemaName,
    status: obj.status,
    appConfig: obj.appConfig || {},
    notificationConfig: obj.notificationConfig || {},
    provisioningJob: obj.provisioningJob || null,
    bootstrap: obj.bootstrap || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

provisioningTenantSchema.methods.toJSON = function toJSON() {
  return this.toSafeJSON();
};

module.exports = mongoose.model('ProvisioningTenant', provisioningTenantSchema);
