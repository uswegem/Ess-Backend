const { sendSuccess, sendError } = require('../utils/apiResponse');
const {
  createProvisioningTenant,
  listProvisioningTenants,
  getProvisioningTenant,
  updateProvisioningTenant,
  provisionProvisioningTenant,
  bootstrapProvisioningTenant,
  activateProvisioningTenant,
  ProvisioningTenantServiceError,
} = require('../services/provisioningTenantService');

function handleError(res, error) {
  if (error instanceof ProvisioningTenantServiceError) {
    return sendError(res, error.statusCode, error.message, { code: error.code });
  }
  if (error.name === 'ValidationError') {
    return sendError(res, 400, error.message, { code: 'VALIDATION_ERROR' });
  }
  return sendError(res, 500, 'Internal server error');
}

class ProvisioningController {
  static async list(req, res) {
    try {
      const result = await listProvisioningTenants(req.query);
      return sendSuccess(res, { data: { tenants: result.tenants }, pagination: result.pagination });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const tenant = await createProvisioningTenant(req.body, { createdBy: req.user?._id });
      return sendSuccess(res, {
        status: 201,
        message: 'Runtime provisioning tenant created successfully',
        data: { tenant: tenant.toSafeJSON() },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const tenant = await getProvisioningTenant(req.params.tenantId);
      return sendSuccess(res, { data: { tenant: tenant.toSafeJSON() } });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const tenant = await updateProvisioningTenant(req.params.tenantId, req.body, { updatedBy: req.user?._id });
      return sendSuccess(res, { message: 'Runtime provisioning tenant updated', data: { tenant: tenant.toSafeJSON() } });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async provision(req, res) {
    try {
      const tenant = await provisionProvisioningTenant(req.params.tenantId, { actorUserId: req.user?._id });
      return sendSuccess(res, {
        status: 202,
        message: 'Runtime provisioning started',
        data: { tenant: tenant.toSafeJSON() },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async bootstrap(req, res) {
    try {
      const tenant = await bootstrapProvisioningTenant(req.params.tenantId, req.body || {}, { actorUserId: req.user?._id });
      return sendSuccess(res, {
        message: 'Runtime bootstrap completed',
        data: { tenant: tenant.toSafeJSON() },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async activate(req, res) {
    try {
      const tenant = await activateProvisioningTenant(req.params.tenantId, { actorUserId: req.user?._id });
      return sendSuccess(res, {
        message: 'Runtime provisioning tenant activated',
        data: { tenant: tenant.toSafeJSON() },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = ProvisioningController;
