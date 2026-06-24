const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    index: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  actorType: {
    type: String,
    enum: ['user', 'api_key', 'system'],
    default: 'user'
  },
  apiKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiKey'
  },
  correlationId: {
    type: String,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login', 'logout', 'create_user', 'update_user', 'delete_user',
      'create_loan', 'update_loan', 'api_call', 'system_event',
      'security_event', 'api_key_rotate', 'api_key_revoke', 'api_key_create',
      'token_refresh', 'select_tenant',
      'tenant_create', 'tenant_update', 'tenant_status_change',
      'onboarding_submit', 'onboarding_review', 'tenant_user_create'
    ]
  },
  description: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !['api_call', 'login', 'security_event', 'token_refresh'].includes(this.action);
    }
  },
  userAgent: {
    type: String
  },
  ipAddress: {
    type: String
  },
  resource: {
    type: String
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for better query performance
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ actorType: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);