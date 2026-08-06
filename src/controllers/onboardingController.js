const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const {
  createDraft,
  getDraft,
  updateDraft,
  validateFspCode,
  submitTenant,
  reviewTenantRequest,
  toPublicTenant
} = require('../services/onboardingService');
const { TenantServiceError } = require('../services/tenantService');

function handleError(res, error) {
  if (error instanceof TenantServiceError) {
    return sendError(res, error.statusCode, error.message, { code: error.code });
  }
  logger.error('Onboarding controller error:', error);
  return sendError(res, 500, 'Internal server error');
}

class OnboardingController {
  static async createDraft(req, res) {
    try {
      const tenant = await createDraft(req.body);
      return sendSuccess(res, {
        status: 201,
        message: 'Onboarding draft created',
        data: { tenant: toPublicTenant(tenant) }
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async getDraft(req, res) {
    try {
      const tenant = await getDraft(req.params.tenantId);
      return sendSuccess(res, { data: { tenant: toPublicTenant(tenant) } });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async updateDraft(req, res) {
    try {
      const tenant = await updateDraft(req.params.tenantId, req.body);
      return sendSuccess(res, { message: 'Draft updated', data: { tenant: toPublicTenant(tenant) } });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async validateFspCode(req, res) {
    try {
      const result = await validateFspCode(req.body.fspCode, req.query.excludeTenantId);
      return sendSuccess(res, { data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async submit(req, res) {
    try {
      const tenant = await submitTenant(req.params.tenantId);
      await AuditLog.create({
        action: 'onboarding_submit',
        description: `Tenant ${tenant.tenantId} submitted for review`,
        userId: req.user?._id,
        tenantId: tenant.tenantId,
        tenant: tenant._id,
        status: 'success'
      });
      return sendSuccess(res, { message: 'Tenant submitted for review', data: { tenant: toPublicTenant(tenant) } });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async review(req, res) {
    try {
      const tenant = await reviewTenantRequest(req.params.tenantId, req.body.decision, {
        reason: req.body.reason,
        reviewedBy: req.user?._id
      });
      await AuditLog.create({
        action: 'onboarding_review',
        description: `Tenant ${tenant.tenantId} reviewed: ${req.body.decision}`,
        userId: req.user?._id,
        tenantId: tenant.tenantId,
        tenant: tenant._id,
        status: 'success',
        metadata: { decision: req.body.decision, reason: req.body.reason }
      });
      return sendSuccess(res, { message: 'Review recorded', data: { tenant: toPublicTenant(tenant) } });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = OnboardingController;
