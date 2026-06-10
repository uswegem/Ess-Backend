/**
 * Loan Status Update Helpers
 * 
 * Helper functions for updating loan status with proper actor tracking
 * and reason logging according to ESS documentation requirements.
 */

const logger = require('./logger');

/**
 * Update loan status to REJECTED with actor tracking
 * 
 * @param {Object} loanMapping - LoanMapping document
 * @param {String} actor - Who rejected: 'FSP', 'EMPLOYEE', 'EMPLOYER', 'SYSTEM'
 * @param {String} reason - Rejection reason
 * @returns {Promise<Object>} Updated loan mapping
 */
async function rejectLoan(loanMapping, actor, reason) {
  if (!['FSP', 'EMPLOYEE', 'EMPLOYER', 'SYSTEM'].includes(actor)) {
    throw new Error(`Invalid actor: ${actor}. Must be FSP, EMPLOYEE, EMPLOYER, or SYSTEM`);
  }

  loanMapping.status = 'REJECTED';
  loanMapping.rejectedBy = actor;
  loanMapping.rejectionReason = reason;

  await loanMapping.save();

  logger.info('Loan rejected', {
    applicationNumber: loanMapping.essApplicationNumber,
    rejectedBy: actor,
    reason: reason
  });

  return loanMapping;
}

/**
 * Update loan status to CANCELLED with actor tracking
 * 
 * @param {Object} loanMapping - LoanMapping document
 * @param {String} actor - Who cancelled: 'FSP', 'EMPLOYEE', 'EMPLOYER', 'SYSTEM'
 * @param {String} reason - Cancellation reason
 * @returns {Promise<Object>} Updated loan mapping
 */
async function cancelLoan(loanMapping, actor, reason) {
  if (!['FSP', 'EMPLOYEE', 'EMPLOYER', 'SYSTEM'].includes(actor)) {
    throw new Error(`Invalid actor: ${actor}. Must be FSP, EMPLOYEE, EMPLOYER, or SYSTEM`);
  }

  loanMapping.status = 'CANCELLED';
  loanMapping.cancelledBy = actor;
  loanMapping.cancellationReason = reason;

  await loanMapping.save();

  logger.info('Loan cancelled', {
    applicationNumber: loanMapping.essApplicationNumber,
    cancelledBy: actor,
    reason: reason
  });

  return loanMapping;
}

/**
 * Update loan status to COMPLETED
 * 
 * @param {Object} loanMapping - LoanMapping document
 * @returns {Promise<Object>} Updated loan mapping
 */
async function completeLoan(loanMapping) {
  loanMapping.status = 'COMPLETED';
  loanMapping.completedAt = new Date();

  await loanMapping.save();

  logger.info('Loan completed', {
    applicationNumber: loanMapping.essApplicationNumber,
    completedAt: loanMapping.completedAt
  });

  return loanMapping;
}

/**
 * Update loan status to WAITING_FOR_LIQUIDATION
 * 
 * @param {Object} loanMapping - LoanMapping document
 * @returns {Promise<Object>} Updated loan mapping
 */
async function setWaitingForLiquidation(loanMapping) {
  loanMapping.status = 'WAITING_FOR_LIQUIDATION';
  loanMapping.liquidationRequestedAt = new Date();

  await loanMapping.save();

  logger.info('Loan set to waiting for liquidation', {
    applicationNumber: loanMapping.essApplicationNumber,
    liquidationRequestedAt: loanMapping.liquidationRequestedAt
  });

  return loanMapping;
}

/**
 * Get human-readable status label
 * 
 * @param {String} status - Status code
 * @param {Object} loanMapping - Optional loan mapping for context
 * @returns {String} Human-readable status
 */
function getStatusLabel(status, loanMapping = null) {
  const labels = {
    'INITIAL_OFFER': 'Initial Offer',
    'OFFER_SUBMITTED': 'Offer Submitted',
    'INITIAL_APPROVAL_SENT': 'Initial Approval Sent',
    'APPROVED': 'Approved',
    'FINAL_APPROVAL_RECEIVED': 'Final Approval Received',
    'CLIENT_CREATED': 'Client Created',
    'LOAN_CREATED': 'Loan Created',
    'DISBURSED': 'Disbursed',
    'COMPLETED': 'Completed',
    'WAITING_FOR_LIQUIDATION': 'Awaiting Liquidation',
    'DISBURSEMENT_FAILURE_NOTIFICATION_SENT': 'Disbursement Failed',
    'FAILED': 'Failed',
    'REJECTED': 'Rejected',
    'CANCELLED': 'Cancelled'
  };

  let label = labels[status] || status;

  // Add actor context for rejected/cancelled
  if (status === 'REJECTED' && loanMapping?.rejectedBy) {
    label += ` by ${loanMapping.rejectedBy}`;
  }
  if (status === 'CANCELLED' && loanMapping?.cancelledBy) {
    label += ` by ${loanMapping.cancelledBy}`;
  }

  return label;
}

/**
 * Check if loan can transition to new status
 * 
 * @param {String} currentStatus - Current loan status
 * @param {String} newStatus - Target status
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canTransitionTo(currentStatus, newStatus) {
  // Define allowed transitions
  const transitions = {
    'INITIAL_OFFER': ['OFFER_SUBMITTED', 'REJECTED', 'CANCELLED', 'FAILED'],
    'OFFER_SUBMITTED': ['INITIAL_APPROVAL_SENT', 'REJECTED', 'CANCELLED', 'FAILED'],
    'INITIAL_APPROVAL_SENT': ['APPROVED', 'REJECTED', 'CANCELLED', 'FAILED'],
    'APPROVED': ['FINAL_APPROVAL_RECEIVED', 'WAITING_FOR_LIQUIDATION', 'REJECTED', 'CANCELLED', 'FAILED'],
    'FINAL_APPROVAL_RECEIVED': ['CLIENT_CREATED', 'REJECTED', 'CANCELLED', 'FAILED'],
    'CLIENT_CREATED': ['LOAN_CREATED', 'REJECTED', 'CANCELLED', 'FAILED'],
    'LOAN_CREATED': ['DISBURSED', 'REJECTED', 'CANCELLED', 'FAILED'],
    'WAITING_FOR_LIQUIDATION': ['LOAN_CREATED', 'DISBURSED', 'REJECTED', 'CANCELLED', 'FAILED'],
    'DISBURSED': ['COMPLETED', 'DISBURSEMENT_FAILURE_NOTIFICATION_SENT', 'FAILED'],
    'DISBURSEMENT_FAILURE_NOTIFICATION_SENT': ['LOAN_CREATED', 'FAILED'],
    'COMPLETED': [],  // Terminal state
    'REJECTED': [],   // Terminal state
    'CANCELLED': [],  // Terminal state
    'FAILED': []      // Terminal state
  };

  const allowedTransitions = transitions[currentStatus] || [];

  if (allowedTransitions.includes(newStatus)) {
    return { allowed: true, reason: null };
  }

  return {
    allowed: false,
    reason: `Cannot transition from ${currentStatus} to ${newStatus}`
  };
}

/**
 * Get loan status statistics
 * 
 * @param {Object} LoanMapping - LoanMapping model
 * @returns {Promise<Object>} Status statistics
 */
async function getStatusStatistics(LoanMapping) {
  const stats = await LoanMapping.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  const rejectionStats = await LoanMapping.aggregate([
    {
      $match: { status: 'REJECTED', rejectedBy: { $exists: true } }
    },
    {
      $group: {
        _id: '$rejectedBy',
        count: { $sum: 1 }
      }
    }
  ]);

  const cancellationStats = await LoanMapping.aggregate([
    {
      $match: { status: 'CANCELLED', cancelledBy: { $exists: true } }
    },
    {
      $group: {
        _id: '$cancelledBy',
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    byStatus: stats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    rejections: rejectionStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    cancellations: cancellationStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    total: stats.reduce((sum, item) => sum + item.count, 0)
  };
}

module.exports = {
  rejectLoan,
  cancelLoan,
  completeLoan,
  setWaitingForLiquidation,
  getStatusLabel,
  canTransitionTo,
  getStatusStatistics
};
