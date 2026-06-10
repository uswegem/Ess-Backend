const mongoose = require('mongoose');

const loanMappingSchema = new mongoose.Schema({
  // ESS identifiers
  essApplicationNumber: {
    type: String,
    required: true,
    index: true,
    // Unique per loan application
  },
  essCheckNumber: {
    type: String,
    index: true,
    // IMPORTANT: Unique per CLIENT, NOT per loan
    // One client (check number) can have multiple loan records
    // DO NOT use this field alone for loan lookups
  },
  essLoanNumberAlias: {
    type: String,
    index: true,
    // Unique loan identifier - use this for loan lookups
  },

  // FSP generated identifiers
  fspReferenceNumber: {
    type: String,
    required: false,  // Not required initially, added during final approval
    sparse: true,     // Allow multiple nulls
    index: true
  },

  // MIFOS identifiers (populated after loan creation)
  mifosClientId: {
    type: Number,
    index: true
  },
  mifosLoanId: {
    type: Number,
    index: true
  },
  mifosLoanAccountNumber: {
    type: String,
    index: true
  },

  // Loan details
  productCode: {
    type: String,
    required: true
  },
  requestedAmount: {
    type: Number,
    required: true
  },
  tenure: {
    type: Number,
    required: true
  },

  // Track original message type that initiated this loan
  originalMessageType: {
    type: String,
    enum: ['LOAN_OFFER_REQUEST', 'TOP_UP_OFFER_REQUEST', 'LOAN_TAKEOVER_OFFER_REQUEST', 'LOAN_RESTRUCTURE_REQUEST'],
    required: false, // Not required for backwards compatibility with existing records
    index: true
  },

  // Status tracking
  status: {
    type: String,
    enum: [
      'INITIAL_OFFER', 
      'INITIAL_APPROVAL_SENT', 
      'APPROVED', 
      'REJECTED', 
      'CANCELLED', 
      'FINAL_APPROVAL_RECEIVED', 
      'CLIENT_CREATED', 
      'LOAN_CREATED', 
      'DISBURSED', 
      'COMPLETED',                              // NEW: Loan fully Disbursed, repaid/closed
      'WAITING_FOR_LIQUIDATION',                // NEW: Takeover loan awaiting liquidation
      'DISBURSEMENT_FAILURE_NOTIFICATION_SENT', 
      'FAILED', 
      'OFFER_SUBMITTED'
    ],
    default: 'INITIAL_OFFER'
  },

  // Actor tracking for rejections and cancellations
  rejectedBy: {
    type: String,
    enum: ['FSP', 'EMPLOYEE', 'EMPLOYER', 'SYSTEM'],
    required: false,
    index: true
  },
  cancelledBy: {
    type: String,
    enum: ['FSP', 'EMPLOYEE', 'EMPLOYER', 'SYSTEM'],
    required: false,
    index: true
  },
  rejectionReason: {
    type: String,
    required: false
  },
  cancellationReason: {
    type: String,
    required: false
  },

  // Timestamps for each stage
  initialOfferSentAt: {
    type: Date,
    default: Date.now
  },
  finalApprovalReceivedAt: {
    type: Date
  },
  clientCreatedAt: {
    type: Date
  },
  loanCreatedAt: {
    type: Date
  },
  disbursedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  liquidationRequestedAt: {
    type: Date
  },
  disbursementFailureNotificationSentAt: {
    type: Date
  },

  // Error tracking
  errorLogs: [{
    stage: String,
    error: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound indexes for efficient lookups
loanMappingSchema.index({ essApplicationNumber: 1, essLoanNumber: 1 });
loanMappingSchema.index({ status: 1 });

// Additional compound indexes for optimized queries
loanMappingSchema.index({ status: 1, createdAt: -1 }); // Status queries with sorting
loanMappingSchema.index({ essApplicationNumber: 1, status: 1 }); // Application + status lookups

// Instance methods
loanMappingSchema.methods.updateStatus = function(newStatus, actor = null, reason = null) {
  this.status = newStatus;

  // Track actor for rejections and cancellations
  if (newStatus === 'REJECTED' && actor) {
    this.rejectedBy = actor;
    if (reason) this.rejectionReason = reason;
  }
  if (newStatus === 'CANCELLED' && actor) {
    this.cancelledBy = actor;
    if (reason) this.cancellationReason = reason;
  }

  // Update timestamp based on status
  const timestampFields = {
    'FINAL_APPROVAL_RECEIVED': 'finalApprovalReceivedAt',
    'CLIENT_CREATED': 'clientCreatedAt',
    'LOAN_CREATED': 'loanCreatedAt',
    'DISBURSED': 'disbursedAt',
    'COMPLETED': 'completedAt',
    'WAITING_FOR_LIQUIDATION': 'liquidationRequestedAt',
    'DISBURSEMENT_FAILURE_NOTIFICATION_SENT': 'disbursementFailureNotificationSentAt'
  };

  if (timestampFields[newStatus]) {
    this[timestampFields[newStatus]] = new Date();
  }

  return this.save();
};

loanMappingSchema.methods.addError = function(stage, error) {
  this.errorLogs.push({
    stage,
    error: error.message || error,
    timestamp: new Date()
  });
  return this.save();
};

// Static methods (return lean queries for read-only operations)
loanMappingSchema.statics.findByEssLoanNumber = function(essLoanNumber) {
  return this.findOne({ essLoanNumber });
};

loanMappingSchema.statics.findByFspReference = function(fspReferenceNumber) {
  return this.findOne({ fspReferenceNumber });
};

loanMappingSchema.statics.findByMifosLoanId = function(mifosLoanId) {
  return this.findOne({ mifosLoanId });
};

// Compound indexes for common query patterns
loanMappingSchema.index({ essApplicationNumber: 1, status: 1 }); // Application status queries
loanMappingSchema.index({ mifosLoanId: 1, status: 1 }); // MIFOS loan status queries
loanMappingSchema.index({ essCheckNumber: 1, originalMessageType: 1 }); // Client loan type queries
loanMappingSchema.index({ createdAt: -1 }); // Chronological queries
loanMappingSchema.index({ status: 1, createdAt: -1 }); // Status with time filtering
loanMappingSchema.index({ originalMessageType: 1, status: 1 }); // Message type analytics
loanMappingSchema.index({ rejectedBy: 1, status: 1 }, { sparse: true }); // Rejection analytics
loanMappingSchema.index({ cancelledBy: 1, status: 1 }, { sparse: true }); // Cancellation analytics

const LoanMapping = mongoose.model('LoanMapping', loanMappingSchema);

module.exports = LoanMapping;