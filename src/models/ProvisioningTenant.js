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
    trim: true,
    default: '102.204.1.22',
    // Descriptive only — actual provisioning goes over a fixed SSH target
    // configured via RUNTIME_SSH_HOST, not this per-tenant field. Still
    // validated against the allowlist so this record can never be mistaken
    // for pointing at the live zedone.miracore.app Fineract instance.
    validate: {
      validator: (value) => !value || isAllowedRuntimeHost(String(value).replace(/^https?:\/\//, '')),
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
  // Contact details for MFI onboarding — who to reach about this tenant's
  // provisioning request, and where the "request received"/eventual
  // "tenant ready" emails go.
  contactFirstName: {
    type: String,
    trim: true,
    required: true,
    maxlength: 100,
  },
  contactSurname: {
    type: String,
    trim: true,
    required: true,
    maxlength: 100,
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    required: true,
    validate: {
      validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message: (props) => `'${props.value}' is not a valid email address.`,
    },
  },
  contactPhone: {
    type: String,
    trim: true,
    required: true,
    // Generic E.164-ish check — an optional leading + then 8-15 digits.
    // Deliberately not restricted to Tanzania (+255) even though that's the
    // common case, since this platform could onboard outside Tanzania.
    validate: {
      validator: (value) => /^\+?[0-9]{8,15}$/.test(value),
      message: (props) => `'${props.value}' is not a valid phone number.`,
    },
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
    contactFirstName: obj.contactFirstName,
    contactSurname: obj.contactSurname,
    contactEmail: obj.contactEmail,
    contactPhone: obj.contactPhone,
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
