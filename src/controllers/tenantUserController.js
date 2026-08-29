const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { sendMail } = require('../utils/mailer');
const {
  listTenantUsers,
  createTenantUser,
  updateTenantUser,
  deactivateTenantUser,
  resetTenantUserPassword,
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

// Shared by update() and updatePermissions() - writes one audit entry per changed field,
// same actor/target convention as tenant_user_create and admin_password_reset. Never fires
// for a no-op (e.g. resubmitting the same permission set, or a plain isActive toggle).
async function auditRoleOrPermissionsChange({
  req, membership, previousRole, previousPermissions, requestedRole, requestedPermissions,
}) {
  const roleChanged = Boolean(requestedRole) && requestedRole !== previousRole;
  const permissionsChanged = Boolean(requestedPermissions)
    && JSON.stringify([...requestedPermissions].sort())
      !== JSON.stringify([...previousPermissions].sort());

  if (!roleChanged && !permissionsChanged) return;

  const targetUserId = membership.userId?._id || membership.userId;
  await AuditLog.create({
    action: 'tenant_user_permissions_update',
    description: `Role/permissions updated for tenant user in ${req.params.tenantId}`,
    userId: req.user?._id,
    tenantId: req.params.tenantId,
    status: 'success',
    metadata: {
      targetUserId,
      ...(roleChanged ? { role: { before: previousRole, after: membership.role } } : {}),
      ...(permissionsChanged
        ? { permissions: { before: previousPermissions, after: membership.permissions } }
        : {})
    }
  });
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
      const { membership, previousRole, previousPermissions } = await updateTenantUser(
        req.params.tenantId,
        req.params.userId,
        req.body,
        req.user?._id
      );

      await auditRoleOrPermissionsChange({
        req,
        membership,
        previousRole,
        previousPermissions,
        requestedRole: req.body.role,
        requestedPermissions: req.body.permissions,
      });

      return sendSuccess(res, {
        message: 'Tenant user updated',
        data: { user: toPublicTenantUser(membership) }
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // Dedicated, permissions-only counterpart to update() above - PUT
  // .../users/:userId/permissions. Same underlying service call (self-lockout guard,
  // ASSIGNABLE_PERMISSIONS denylist already enforced by updateUserPermissionsSchema at the
  // route level), scoped to exactly one field so this action can't also change role/isActive.
  static async updatePermissions(req, res) {
    try {
      const { membership, previousRole, previousPermissions } = await updateTenantUser(
        req.params.tenantId,
        req.params.userId,
        { permissions: req.body.permissions },
        req.user?._id
      );

      await auditRoleOrPermissionsChange({
        req,
        membership,
        previousRole,
        previousPermissions,
        requestedRole: null,
        requestedPermissions: req.body.permissions,
      });

      return sendSuccess(res, {
        message: 'Permissions updated',
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

  // Admin-initiated password reset - see tenantUserService.js's resetTenantUserPassword for
  // the UX/security-design rationale (temp password + existing credentials-dialog reuse,
  // session invalidation, audit trail). Route-level tenant-match guard (own-tenant vs.
  // platform-admin) lives in routes/tenants.js, ahead of this handler.
  static async resetPassword(req, res) {
    try {
      const { membership, credentials } = await resetTenantUserPassword(req.params.tenantId, req.params.userId);
      const targetUserId = membership.userId._id || membership.userId;

      await AuditLog.create({
        action: 'admin_password_reset',
        description: `Password reset by admin for user: ${credentials.username}`,
        userId: req.user?._id, // the acting admin - same actor/target convention as tenant_user_create above
        tenantId: req.params.tenantId,
        status: 'success',
        metadata: { targetUserId } // never the password itself
      });

      // Transparency notice only - never includes the new password itself (the admin already
      // has it via the response below, to share through the one-time credentials dialog).
      // Best-effort: an email failure must not block the reset that already succeeded, same
      // resilience pattern as authController.js's forgotPassword.
      if (credentials.email) {
        sendMail({
          to: credentials.email,
          subject: 'Your password was reset by an administrator',
          text: `An administrator reset your password for your account (${credentials.username}). If you did not expect this, contact your administrator immediately.`,
          html: `<p>An administrator reset your password for your account (<strong>${credentials.username}</strong>).</p><p>If you did not expect this, contact your administrator immediately.</p>`
        }).catch((err) => logger.warn('admin_password_reset notification email failed', { error: err.message, targetUserId }));
      }

      return sendSuccess(res, {
        message: 'Password reset. Share the one-time credentials with the user.',
        data: { credentials }
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = TenantUserController;
