const mongoose = require('mongoose');

const TENANT_ROLES = [
  'tenant_admin',
  'operations_manager',
  'finance_officer',
  'support_staff'
];

const ROLE_PERMISSIONS = {
  tenant_admin: [
    'tenant:read',
    'tenant:update',
    'users:manage',
    'api_keys:manage',
    'dashboard:read',
    'audit:read'
  ],
  operations_manager: [
    'loans:read',
    'loans:operate',
    'messages:read',
    'messages:operate',
    'dashboard:read'
  ],
  finance_officer: [
    'loans:read',
    'repayments:read',
    'dashboard:read',
    'reports:read'
  ],
  support_staff: [
    'loans:read',
    'messages:read',
    'notifications:read'
  ]
};

const tenantUserSchema = new mongoose.Schema({
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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: TENANT_ROLES,
    required: true
  },
  permissions: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  invitedAt: Date,
  activatedAt: Date,
  deactivatedAt: Date,
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

tenantUserSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
tenantUserSchema.index({ tenantId: 1, role: 1 });
tenantUserSchema.index({ userId: 1, isActive: 1 });
tenantUserSchema.index({ tenantId: 1, isActive: 1 });

tenantUserSchema.methods.getEffectivePermissions = function getEffectivePermissions() {
  const roleDefaults = ROLE_PERMISSIONS[this.role] || [];
  const custom = this.permissions || [];
  return [...new Set([...roleDefaults, ...custom])];
};

tenantUserSchema.methods.hasPermission = function hasPermission(permission) {
  return this.getEffectivePermissions().includes(permission);
};

tenantUserSchema.statics.findActiveMembership = function findActiveMembership(userId, tenantId) {
  return this.findOne({ userId, tenantId, isActive: true });
};

tenantUserSchema.statics.findActiveTenantsForUser = function findActiveTenantsForUser(userId) {
  return this.find({ userId, isActive: true }).populate('tenant', 'tenantId tenantName fspCode status');
};

module.exports = mongoose.model('TenantUser', tenantUserSchema);
module.exports.TENANT_ROLES = TENANT_ROLES;
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
