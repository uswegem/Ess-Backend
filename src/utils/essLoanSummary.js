/**
 * Maps LoanMapping internal statuses to ESS-facing dashboard buckets.
 */
const ESS_LOAN_SUMMARY_BUCKETS = {
  pendingEmployerApproval: {
    label: 'Pending Employer Approval',
    statuses: ['INITIAL_OFFER', 'OFFER_SUBMITTED', 'INITIAL_APPROVAL_SENT'],
  },
  pendingFspApproval: {
    label: 'Pending FSP Approval',
    statuses: ['APPROVED', 'FINAL_APPROVAL_RECEIVED'],
  },
  activeLoans: {
    label: 'Active Loans',
    statuses: ['CLIENT_CREATED', 'LOAN_CREATED', 'DISBURSED', 'WAITING_FOR_LIQUIDATION'],
  },
  cancelled: {
    label: 'Cancelled',
    statuses: ['CANCELLED'],
  },
  rejected: {
    label: 'Rejected',
    statuses: ['REJECTED', 'FAILED', 'DISBURSEMENT_FAILURE_NOTIFICATION_SENT'],
  },
  closedFullyRepaid: {
    label: 'Closed (Fully Repaid)',
    statuses: ['COMPLETED'],
  },
};

function buildEssLoanSummary(loansByStatus = []) {
  const countByStatus = loansByStatus.reduce((acc, item) => {
    const key = item._id || item.status;
    acc[key] = item.count || 0;
    return acc;
  }, {});

  return Object.entries(ESS_LOAN_SUMMARY_BUCKETS).map(([key, bucket]) => ({
    key,
    label: bucket.label,
    count: bucket.statuses.reduce((sum, status) => sum + (countByStatus[status] || 0), 0),
  }));
}

module.exports = {
  ESS_LOAN_SUMMARY_BUCKETS,
  buildEssLoanSummary,
};
