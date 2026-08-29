const { sendSuccess, sendError } = require('../utils/apiResponse');
const {
  provisionRuntimeTenant,
  bootstrapRuntimeTenant,
  activateRuntimeTenant,
  RuntimeProvisioningServiceError,
} = require('../services/runtimeProvisioningService');

function handleError(res, error) {
  if (error instanceof RuntimeProvisioningServiceError) {
    return sendError(res, error.statusCode, error.message, { code: error.code });
  }
  return sendError(res, 500, 'Internal server error');
}

class RuntimeProvisioningController {
  static async provision(req, res) {
    try {
      const result = await provisionRuntimeTenant(req.body || {});
      return sendSuccess(res, { data: result.data, message: result.message });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async bootstrap(req, res) {
    try {
      const result = await bootstrapRuntimeTenant(req.body || {});
      return sendSuccess(res, { data: result.data, message: result.message });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async activate(req, res) {
    try {
      const result = await activateRuntimeTenant(req.body || {});
      return sendSuccess(res, { data: result.data, message: result.message });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = RuntimeProvisioningController;
