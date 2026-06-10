const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  messageType: {
    type: String,
    required: true,
    enum: [
      'RESPONSE',
      'ACCOUNT_VALIDATION_RESPONSE',
      'DEFAULTER_DETAILS_TO_EMPLOYER',
      'FSP_BRANCHES',
      'FULL_LOAN_REPAYMENT_NOTIFICATION',
      'FULL_LOAN_REPAYMENT_REQUEST',
      'LOAN_CHARGES_RESPONSE',
      'LOAN_DISBURSEMENT_FAILURE_NOTIFICATION',
      'LOAN_DISBURSEMENT_NOTIFICATION',
      'LOAN_INITIAL_APPROVAL_NOTIFICATION',
      'LOAN_LIQUIDATION_NOTIFICATION',
      'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST',
      'LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE',
      'LOAN_RESTRUCTURE_BALANCE_REQUEST',
      'LOAN_RESTRUCTURE_BALANCE_RESPONSE',
      'LOAN_RESTRUCTURE_REQUEST_FSP',
      'LOAN_STATUS_REQUEST',
      'LOAN_TAKEOVER_BALANCE_RESPONSE',
      'LOAN_TOP_UP_BALANCE_RESPONSE',
      'PARTIAL_LOAN_REPAYMENT_NOTIFICATION',
      'PARTIAL_REPAYMENT_OFF_BALANCE_RESPONSE',
      'PAYMENT_ACKNOWLEDGMENT_NOTIFICATION',
      'PRODUCT_DECOMMISSION',
      'PRODUCT_DETAIL',
      'TAKEOVER_DISBURSEMENT_NOTIFICATION'
    ]
  },
  direction: {
    type: String,
    enum: ['outgoing', 'incoming'],
    default: 'outgoing'
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'pending', 'resent'],
    default: 'pending'
  },
  xmlPayload: {
    type: String,
    required: true
  },
  response: {
    type: String
  },
  errorMessage: {
    type: String
  },
  applicationNumber: {
    type: String
  },
  loanNumber: {
    type: String
  },
  fspReferenceNumber: {
    type: String
  },
  sender: {
    type: String,
    default: 'ZE DONE'
  },
  receiver: {
    type: String,
    default: 'ESS_UTUMISHI'
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sentAt: {
    type: Date
  },
  resentAt: {
    type: Date
  },
  retryCount: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
messageLogSchema.index({ messageType: 1 });
messageLogSchema.index({ status: 1 });
messageLogSchema.index({ createdAt: -1 });
messageLogSchema.index({ applicationNumber: 1 });
messageLogSchema.index({ loanNumber: 1 });
messageLogSchema.index({ messageId: 1 });

module.exports = mongoose.model('MessageLog', messageLogSchema);