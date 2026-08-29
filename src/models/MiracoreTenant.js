const mongoose = require('mongoose');

const miracoreTenantSchema = new mongoose.Schema({
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

miracoreTenantSchema.index({ status: 1, createdAt: -1 });

miracoreTenantSchema.methods.toSafeJSON = function toSafeJSON() {
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

miracoreTenantSchema.methods.toJSON = function toJSON() {
  return this.toSafeJSON();
};

module.exports = mongoose.model('MiracoreTenant', miracoreTenantSchema);
