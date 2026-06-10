const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'login', 'logout', 'create_user', 'update_user', 'delete_user',
      'create_loan', 'update_loan', 'api_call', 'system_event'
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
      // userId optional for api_call and failed login attempts
      return !['api_call', 'login'].includes(this.action);
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
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);