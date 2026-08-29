const { sendSuccess, sendError } = require('../utils/apiResponse');
const {
  createMiracoreTenant,
  listMiracoreTenants,
  getMiracoreTenant,
  updateMiracoreTenant,
  provisionMiracoreTenant,
  bootstrapMiracoreTenant,
  activateMiracoreTenant,
  MiracoreTenantServiceError,
} = require('../services/miracoreTenantService');

function handleError(res, error) {
  if (error instanceof MiracoreTenantServiceError) {
    return sendError(res, error.statusCode, error.message, { code: error.code });
  }
  return sendError(res, 500, 'Internal server error');
}

class MiracoreController {
  static async list(req, res) {
    try {
      const result = await listMiracoreTenants(req.query);
      return sendSuccess(res, { data: { tenants: result.tenants }, pagination: result.pagination });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const tenant = await createMiracoreTenant(req.body, { createdBy: req.user?._id });
      return sendSuccess(res, {
        status: 201,
        message: 'Miracore tenant created successfully',
        data: { tenant: tenant.toSafeJSON() },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const tenant = await getMiracoreTenant(req.params.tenantId);
      return sendSuccess(res, { data: { tenant: tenant.toSafeJSON() } });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const tenant = await updateMiracoreTenant(req.params.tenantId, req.body, { updatedBy: req.user?._id });
      return sendSuccess(res, { message: 'Miracore tenant updated', data: { tenant: tenant.toSafeJSON() } });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async provision(req, res) {
    try {
      const tenant = await provisionMiracoreTenant(req.params.tenantId);
      return sendSuccess(res, {
        status: 202,
        message: 'Miracore provisioning started',
        data: { tenant: tenant.toSafeJSON() },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async bootstrap(req, res) {
    try {
      const tenant = await bootstrapMiracoreTenant(req.params.tenantId, req.body || {});
      return sendSuccess(res, {
        message: 'Miracore bootstrap completed',
        data: { tenant: tenant.toSafeJSON() },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async activate(req, res) {
    try {
      const tenant = await activateMiracoreTenant(req.params.tenantId);
      return sendSuccess(res, {
        message: 'Miracore tenant activated',
        data: { tenant: tenant.toSafeJSON() },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = MiracoreController;
