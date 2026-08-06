const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    index: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info'
  },
  category: {
    type: String,
    enum: ['loan', 'user', 'system', 'message', 'payment'],
    default: 'system'
  },
  read: {
    type: Boolean,
    default: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  relatedEntity: {
    type: String, // e.g., loan ID, message ID
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, userId: 1, read: 1 });
notificationSchema.index({ tenantId: 1, category: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
