const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');
const ApiKey = require('../models/ApiKey');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const {
  createTenant,
  listTenants,
  getTenantById,
  updateTenant,
  patchTenantStatus,
  toPublicTenant,
  TenantServiceError
} = require('../services/tenantService');
const { saveMifosConfig, validateMifosConfig, MifosConfigError } = require('../services/mifosConfigService');
const { getEffectiveConfig } = require('../services/mifosTenantClient');

function isKnownServiceError(error) {
  return (
    error instanceof TenantServiceError
    || error instanceof MifosConfigError
    || error?.code === 'MIFOS_CONFIG_ERROR'
    || error?.code === 'TENANT_ERROR'
    || error?.code === 'INVALID_STATUS_TRANSITION'
    || (typeof error?.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500)
  );
}

function handleServiceError(res, error) {
  if (isKnownServiceError(error)) {
    const statusCode = error.statusCode || 400;
    return sendError(res, statusCode, error.message, { code: error.code });
  }
  logger.error('Tenant controller error:', error);
  return sendError(res, 500, 'Internal server error');
}

function canManageAllTenants(req) {
  return req.authContext?.isSuperAdmin || req.user?.role === 'admin';
}

function canAccessTenant(req, tenantId) {
  if (canManageAllTenants(req)) return true;
  return req.tenant?.tenantId === tenantId || req.tokenPayload?.tenantId === tenantId;
}

class TenantController {
  static async create(req, res) {
    try {
      const tenant = await createTenant(req.body, {
        createdBy: req.user?._id,
        status: req.body.status || 'draft'
      });

      await AuditLog.create({
        action: 'tenant_create',
        description: `Tenant created: ${tenant.tenantId}`,
        userId: req.user?._id,
        tenantId: tenant.tenantId,
        tenant: tenant._id,
        status: 'success'
      });

      return sendSuccess(res, {
        status: 201,
        message: 'Tenant created successfully',
        data: { tenant: toPublicTenant(tenant) }
      });
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async list(req, res) {
    try {
      const scopedTenantId = canManageAllTenants(req) ? undefined : req.tenant?.tenantId;
      const result = await listTenants({ ...req.query, scopedTenantId });
      return sendSuccess(res, { data: { tenants: result.tenants }, pagination: result.pagination });
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const { tenantId } = req.params;
      if (!canAccessTenant(req, tenantId)) {
        return sendError(res, 403, 'Access denied for this tenant');
      }
      const tenant = await getTenantById(tenantId);
      return sendSuccess(res, { data: { tenant: toPublicTenant(tenant) } });
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const { tenantId } = req.params;
      if (!canAccessTenant(req, tenantId)) {
        return sendError(res, 403, 'Access denied for this tenant');
      }
      const tenant = await updateTenant(tenantId, req.body, req.user?._id);
      await AuditLog.create({
        action: 'tenant_update',
        description: `Tenant updated: ${tenantId}`,
        userId: req.user?._id,
        tenantId,
        tenant: tenant._id,
        status: 'success'
      });
      return sendSuccess(res, { message: 'Tenant updated successfully', data: { tenant: toPublicTenant(tenant) } });
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async patchStatus(req, res) {
    try {
      const { tenantId } = req.params;
      const tenant = await patchTenantStatus(tenantId, req.body.status, {
        reason: req.body.reason,
        reviewedBy: req.user?._id
      });
      await AuditLog.create({
        action: 'tenant_status_change',
        description: `Tenant ${tenantId} status -> ${req.body.status}`,
        userId: req.user?._id,
        tenantId,
        tenant: tenant._id,
        status: 'success',
        metadata: { status: req.body.status, reason: req.body.reason }
      });
      return sendSuccess(res, { message: 'Tenant status updated', data: { tenant: toPublicTenant(tenant) } });
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async saveMifosConfig(req, res) {
    try {
      const { tenantId } = req.params;
      if (!canAccessTenant(req, tenantId)) {
        return sendError(res, 403, 'Access denied for this tenant');
      }
      const tenant = await getTenantById(tenantId);
      await saveMifosConfig(tenant, req.body, req.user?._id);
      return sendSuccess(res, { message: 'MIFOS configuration saved', data: { tenant: toPublicTenant(tenant) } });
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async validateMifosConfig(req, res) {
    try {
      const { tenantId } = req.params;
      if (!canAccessTenant(req, tenantId)) {
        return sendError(res, 403, 'Access denied for this tenant');
      }
      const tenant = await getTenantById(tenantId);
      const payload = req.body && Object.keys(req.body).length > 0 ? req.body : null;
      const result = await validateMifosConfig(tenant, payload);
      return sendSuccess(res, { data: result });
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async integrationHealth(req, res) {
    try {
      const { tenantId } = req.params;
      const tenant = await getTenantById(tenantId);
      const mifosResult = await validateMifosConfig(tenant);
      const activeKeys = await ApiKey.countDocuments({ tenantId, status: 'active' });
      const config = getEffectiveConfig(tenant);

      return sendSuccess(res, {
        data: {
          tenantId,
          status: tenant.status,
          mifos: {
            mode: config.mode,
            baseUrl: config.baseUrl,
            fineractTenantId: config.tenantId,
            valid: mifosResult.valid,
            checkedAt: mifosResult.checkedAt,
            message: mifosResult.message
          },
          apiKeys: { active: activeKeys }
        }
      });
    } catch (error) {
      return handleServiceError(res, error);
    }
  }
}

module.exports = TenantController;
