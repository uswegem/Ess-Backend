const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const {
  listTenantUsers,
  createTenantUser,
  updateTenantUser,
  deactivateTenantUser,
  toPublicTenantUser,
  TenantUserServiceError
} = require('../services/tenantUserService');

function handleError(res, error) {
  if (error instanceof TenantUserServiceError) {
    return sendError(res, error.statusCode, error.message, { code: error.code });
  }
  logger.error('Tenant user controller error:', error);
  return sendError(res, 500, 'Internal server error');
}

class TenantUserController {
  static async list(req, res) {
    try {
      const result = await listTenantUsers(req.params.tenantId, req.query);
      return sendSuccess(res, { data: { users: result.users }, pagination: result.pagination });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const { membership, credentials } = await createTenantUser(
        req.params.tenantId,
        req.body,
        req.user?._id
      );
      await AuditLog.create({
        action: 'tenant_user_create',
        description: `User added to tenant ${req.params.tenantId}`,
        userId: req.user?._id,
        tenantId: req.params.tenantId,
        status: 'success',
        metadata: { targetUserId: membership.userId, isNewAccount: credentials.isNewAccount }
      });
      return sendSuccess(res, {
        status: 201,
        message: credentials.isNewAccount
          ? 'Tenant user created. Share the one-time credentials with the user.'
          : 'Existing user added to tenant.',
        data: {
          user: toPublicTenantUser(membership),
          credentials
        }
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const membership = await updateTenantUser(req.params.tenantId, req.params.userId, req.body);
      return sendSuccess(res, {
        message: 'Tenant user updated',
        data: { user: toPublicTenantUser(membership) }
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async remove(req, res) {
    try {
      const membership = await deactivateTenantUser(req.params.tenantId, req.params.userId, req.user?._id);
      return sendSuccess(res, {
        message: 'Tenant user deactivated',
        data: { user: toPublicTenantUser(membership) }
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = TenantUserController;
