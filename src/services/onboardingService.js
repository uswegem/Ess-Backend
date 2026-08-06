const Tenant = require('../models/Tenant');
const {
  createTenant,
  getTenantById,
  updateTenant,
  isFspCodeAvailable,
  toPublicTenant,
  TenantServiceError
} = require('./tenantService');
const { submitForReview, reviewTenant } = require('./tenantStatusService');
const { saveMifosConfig, isMifosConfigured } = require('./mifosConfigService');

async function createDraft(payload) {
  return createTenant({
    tenantName: payload.tenantName,
    fspCode: payload.fspCode,
    contactEmail: payload.contactEmail,
    contactPerson: payload.tenantName,
    contactPhone: '+255000000000',
    fspName: payload.tenantName,
    tenantId: payload.tenantId
  }, { status: 'draft' });
}

async function getDraft(tenantId) {
  const tenant = await getTenantById(tenantId);
  if (tenant.status !== 'draft' && tenant.status !== 'submitted') {
    throw new TenantServiceError('Draft not available for this tenant', 400, 'NOT_A_DRAFT');
  }
  if (tenant.onboarding?.draftExpiresAt && tenant.onboarding.draftExpiresAt < new Date()) {
    throw new TenantServiceError('Draft has expired', 410, 'DRAFT_EXPIRED');
  }
  return tenant;
}

async function updateDraft(tenantId, payload) {
  const tenant = await getDraft(tenantId);

  if (payload.companyInfo) {
    await updateTenant(tenantId, payload.companyInfo);
    const refreshed = await getTenantById(tenantId);
    Object.assign(tenant, refreshed.toObject());
  }

  if (payload.mifosConfig) {
    await saveMifosConfig(tenant, payload.mifosConfig);
  }

  if (payload.completedSteps) {
    tenant.onboarding = tenant.onboarding || {};
    tenant.onboarding.completedSteps = payload.completedSteps;
    await tenant.save();
  }

  return getTenantById(tenantId);
}

async function validateFspCode(fspCode, excludeTenantId) {
  const available = await isFspCodeAvailable(fspCode, excludeTenantId);
  return { available };
}

function assertSubmitReady(tenant) {
  const required = ['tenantName', 'fspCode', 'fspName', 'contactPerson', 'contactEmail', 'contactPhone'];
  const missing = required.filter((field) => !tenant[field]);
  if (missing.length) {
    throw new TenantServiceError(`Missing required fields: ${missing.join(', ')}`, 400, 'INCOMPLETE_TENANT');
  }
  if (!isMifosConfigured(tenant)) {
    throw new TenantServiceError('MIFOS configuration is required before submit', 400, 'MIFOS_NOT_CONFIGURED');
  }
}

async function submitTenant(tenantId) {
  const tenant = await getTenantById(tenantId);
  assertSubmitReady(tenant);
  submitForReview(tenant);
  await tenant.save();
  return tenant;
}

async function reviewTenantRequest(tenantId, decision, { reason, reviewedBy } = {}) {
  const tenant = await getTenantById(tenantId);
  reviewTenant(tenant, decision, { reason, reviewedBy });
  await tenant.save();
  return tenant;
}

module.exports = {
  createDraft,
  getDraft,
  updateDraft,
  validateFspCode,
  submitTenant,
  reviewTenantRequest,
  toPublicTenant
};
