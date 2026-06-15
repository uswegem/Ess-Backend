const mongoose = require('mongoose');
const { encryptSecret, decryptSecret } = require('../utils/tenantSecretCrypto');

const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,62}$/;
const FSP_CODE_PATTERN = /^[A-Z0-9]{2,20}$/;

const tenantSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    immutable: true,
    validate: {
      validator(value) {
        return TENANT_ID_PATTERN.test(value);
      },
      message: 'tenantId must be 3-63 lowercase alphanumeric characters, hyphens, or underscores'
    }
  },
  tenantName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  fspCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    validate: {
      validator(value) {
        return FSP_CODE_PATTERN.test(value);
      },
      message: 'fspCode must be 2-20 uppercase alphanumeric characters'
    }
  },
  fspName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  organizationRegistrationNumber: {
    type: String,
    trim: true
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  contactEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'contactEmail must be a valid email address']
  },
  contactPhone: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  address: {
    line1: String,
    line2: String,
    city: String,
    region: String,
    country: { type: String, default: 'TZ' }
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'active', 'rejected', 'suspended', 'disabled'],
    default: 'draft'
  },
  onboarding: {
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
    completedSteps: [String],
    draftExpiresAt: Date
  },
  mifosConfig: {
    mode: {
      type: String,
      enum: ['inherit_default', 'override'],
      default: 'inherit_default'
    },
    baseUrl: String,
    tenantId: String,
    makerUsername: String,
    makerPasswordEncrypted: String,
    checkerUsername: String,
    checkerPasswordEncrypted: String,
    callbackUrl: String,
    timeoutMs: { type: Number, default: 30000 },
    isConfigured: { type: Boolean, default: false },
    lastValidatedAt: Date
  },
  apiCredentials: {
    defaultRateLimitPerMinute: { type: Number, default: 60, min: 1 },
    defaultRateLimitPerHour: { type: Number, default: 1000, min: 1 },
    requireIpWhitelist: { type: Boolean, default: false },
    requireSignature: { type: Boolean, default: true }
  },
  certificates: {
    publicCertificatePath: String,
    privateKeyPath: String,
    caCertificatePath: String,
    certificateFingerprint: String,
    expiresAt: Date,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['trial', 'standard', 'enterprise'],
      default: 'standard'
    },
    monthlyLimit: { type: Number, default: 10000, min: 0 },
    currentMonthUsage: { type: Number, default: 0, min: 0 },
    startsAt: Date,
    endsAt: Date
  },
  metadata: {
    logoUrl: String,
    theme: {
      primaryColor: String,
      secondaryColor: String
    },
    supportEmail: String,
    supportPhone: String,
    notes: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

tenantSchema.index({ tenantId: 1 }, { unique: true });
tenantSchema.index({ fspCode: 1 }, { unique: true });
tenantSchema.index({ status: 1, createdAt: -1 });
tenantSchema.index({ 'onboarding.submittedAt': -1 });
tenantSchema.index({ contactEmail: 1 });

tenantSchema.pre('save', function encryptMifosPasswords(next) {
  try {
    if (this.isModified('mifosConfig.makerPasswordEncrypted') && this.mifosConfig?.makerPasswordEncrypted) {
      const value = this.mifosConfig.makerPasswordEncrypted;
      if (!value.includes(':')) {
        this.mifosConfig.makerPasswordEncrypted = encryptSecret(value);
      }
    }
    if (this.isModified('mifosConfig.checkerPasswordEncrypted') && this.mifosConfig?.checkerPasswordEncrypted) {
      const value = this.mifosConfig.checkerPasswordEncrypted;
      if (!value.includes(':')) {
        this.mifosConfig.checkerPasswordEncrypted = encryptSecret(value);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

tenantSchema.methods.getMakerPassword = function getMakerPassword() {
  return decryptSecret(this.mifosConfig?.makerPasswordEncrypted);
};

tenantSchema.methods.getCheckerPassword = function getCheckerPassword() {
  return decryptSecret(this.mifosConfig?.checkerPasswordEncrypted);
};

tenantSchema.methods.isOperational = function isOperational() {
  return this.status === 'active';
};

tenantSchema.methods.toSafeJSON = function toSafeJSON() {
  const tenant = this.toObject();
  if (tenant.mifosConfig) {
    delete tenant.mifosConfig.makerPasswordEncrypted;
    delete tenant.mifosConfig.checkerPasswordEncrypted;
  }
  if (tenant.certificates) {
    delete tenant.certificates.privateKeyPath;
  }
  return tenant;
};

tenantSchema.methods.toJSON = function toJSON() {
  return this.toSafeJSON();
};

module.exports = mongoose.model('Tenant', tenantSchema);
