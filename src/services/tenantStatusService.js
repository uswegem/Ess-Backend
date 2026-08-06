const ALLOWED_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['under_review', 'submitted'],
  under_review: ['approved', 'rejected'],
  approved: ['active'],
  active: ['suspended', 'disabled'],
  suspended: ['active', 'disabled'],
  rejected: [],
  disabled: []
};

const SUBMIT_TRANSITION = { from: 'draft', to: 'submitted' };
const REVIEW_APPROVE = { from: 'under_review', to: 'approved' };
const REVIEW_REJECT = { from: 'under_review', to: 'rejected' };

class TenantStatusError extends Error {
  constructor(message, code = 'INVALID_STATUS_TRANSITION') {
    super(message);
    this.code = code;
    this.statusCode = 400;
  }
}

function canTransition(currentStatus, nextStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

function assertTransition(tenant, nextStatus) {
  if (!canTransition(tenant.status, nextStatus)) {
    throw new TenantStatusError(
      `Cannot transition tenant from '${tenant.status}' to '${nextStatus}'`
    );
  }
}

function applyTransition(tenant, nextStatus, { reason, reviewedBy } = {}) {
  assertTransition(tenant, nextStatus);
  const previous = tenant.status;
  tenant.status = nextStatus;

  if (nextStatus === 'submitted') {
    tenant.onboarding = tenant.onboarding || {};
    tenant.onboarding.submittedAt = new Date();
    if (previous === 'submitted') {
      tenant.status = 'under_review';
    }
  }

  if (nextStatus === 'under_review') {
    tenant.onboarding = tenant.onboarding || {};
  }

  if (nextStatus === 'approved' || nextStatus === 'rejected') {
    tenant.onboarding = tenant.onboarding || {};
    tenant.onboarding.reviewedAt = new Date();
    if (reviewedBy) tenant.onboarding.reviewedBy = reviewedBy;
    if (nextStatus === 'rejected' && reason) {
      tenant.onboarding.rejectionReason = reason;
    }
  }

  if (nextStatus === 'suspended' && reason) {
    tenant.metadata = tenant.metadata || {};
    tenant.metadata.suspensionReason = reason;
  }

  return tenant;
}

function submitForReview(tenant) {
  if (tenant.status === 'draft') {
    return applyTransition(tenant, 'submitted');
  }
  if (tenant.status === 'submitted') {
    tenant.status = 'under_review';
    return tenant;
  }
  throw new TenantStatusError(`Tenant in status '${tenant.status}' cannot be submitted`);
}

function reviewTenant(tenant, decision, { reason, reviewedBy } = {}) {
  if (tenant.status === 'submitted') {
    tenant.status = 'under_review';
  }
  if (tenant.status !== 'under_review') {
    throw new TenantStatusError(`Tenant must be under_review to review (current: ${tenant.status})`);
  }
  const nextStatus = decision === 'approve' ? 'approved' : 'rejected';
  return applyTransition(tenant, nextStatus, { reason, reviewedBy });
}

module.exports = {
  ALLOWED_TRANSITIONS,
  TenantStatusError,
  canTransition,
  assertTransition,
  applyTransition,
  submitForReview,
  reviewTenant
};
