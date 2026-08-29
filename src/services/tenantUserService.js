const User = require('../models/User');
const TenantUser = require('../models/TenantUser');
const RefreshToken = require('../models/RefreshToken');
const { getTenantById, TenantServiceError } = require('./tenantService');

class TenantUserServiceError extends Error {
  constructor(message, statusCode = 400, code = 'TENANT_USER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function toPublicTenantUser(membership) {
  const user = membership.userId;
  return {
    id: membership._id,
    userId: user?._id || membership.userId,
    tenantId: membership.tenantId,
    email: user?.email,
    username: user?.username,
    fullName: user?.fullName,
    phone: user?.phone,
    role: membership.role,
    permissions: membership.getEffectivePermissions(),
    // Raw custom overrides only (excludes role defaults) - the Users page's permission
    // editor needs this distinct from the effective union above, so it can show which
    // checkboxes are "from role" (locked) vs. individually granted (editable).
    customPermissions: membership.permissions || [],
    isActive: membership.isActive,
    invitedAt: membership.invitedAt,
    activatedAt: membership.activatedAt,
    createdAt: membership.createdAt
  };
}

async function listTenantUsers(tenantId, { page = 1, limit = 20 } = {}) {
  await getTenantById(tenantId);
  const skip = (page - 1) * limit;
  const filter = { tenantId };

  const [memberships, total] = await Promise.all([
    TenantUser.find(filter)
      .populate('userId', 'username email fullName phone isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    TenantUser.countDocuments(filter)
  ]);

  return {
    users: memberships.map(toPublicTenantUser),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

function generateTemporaryPassword() {
  return `Tmp${Math.random().toString(36).slice(2, 10)}!`;
}

async function createTenantUser(tenantId, payload, invitedBy) {
  const tenant = await getTenantById(tenantId);

  let temporaryPassword = null;
  let user = await User.findOne({ email: payload.email.toLowerCase() });
  if (!user) {
    const username = payload.username || payload.email.split('@')[0].toLowerCase();
    const existingUsername = await User.findOne({ username });
    const finalUsername = existingUsername ? `${username}-${Date.now()}` : username;
    temporaryPassword = generateTemporaryPassword();

    user = await User.create({
      username: finalUsername,
      email: payload.email.toLowerCase(),
      password: temporaryPassword,
      fullName: payload.fullName,
      phone: payload.phone,
      role: 'user',
      createdBy: invitedBy
    });
  }

  const existingMembership = await TenantUser.findOne({ tenantId, userId: user._id });
  if (existingMembership) {
    throw new TenantUserServiceError('User is already a member of this tenant', 409, 'DUPLICATE_MEMBERSHIP');
  }

  const membership = await TenantUser.create({
    tenantId: tenant.tenantId,
    tenant: tenant._id,
    userId: user._id,
    role: payload.role,
    permissions: payload.permissions || [],
    isActive: true,
    invitedBy,
    invitedAt: new Date(),
    activatedAt: new Date()
  });

  await membership.populate('userId', 'username email fullName phone isActive');

  const credentials = temporaryPassword
    ? {
        username: user.username,
        email: user.email,
        temporaryPassword,
        isNewAccount: true
      }
    : {
        username: user.username,
        email: user.email,
        isNewAccount: false
      };

  return { membership, credentials };
}

async function updateTenantUser(tenantId, userId, payload, actingUserId) {
  const membership = await TenantUser.findOne({ tenantId, userId }).populate('userId', 'username email fullName phone');
  if (!membership) {
    throw new TenantUserServiceError('Tenant user not found', 404, 'TENANT_USER_NOT_FOUND');
  }

  const previousRole = membership.role;
  const previousPermissions = [...(membership.permissions || [])];

  if (payload.role) membership.role = payload.role;
  if (payload.permissions) membership.permissions = payload.permissions;

  // Self-lockout guard: only fires when the caller is editing their own membership's role
  // or permissions. Checked against the post-change effective permissions (role default +
  // custom overrides), so it catches every way users:manage could be lost - a role
  // downgrade, a custom-permission removal, or both at once.
  const targetUserId = String(membership.userId?._id || membership.userId);
  const isEditingSelf = actingUserId && targetUserId === String(actingUserId);
  if (isEditingSelf && (payload.role || payload.permissions)) {
    if (!membership.getEffectivePermissions().includes('users:manage')) {
      throw new TenantUserServiceError(
        'You cannot remove your own admin access this way. Ask another tenant admin to make this change.',
        400,
        'SELF_LOCKOUT_BLOCKED'
      );
    }
  }

  if (payload.isActive === false) {
    membership.isActive = false;
    membership.deactivatedAt = new Date();
  } else if (payload.isActive === true) {
    membership.isActive = true;
    membership.deactivatedAt = undefined;
    membership.activatedAt = new Date();
  }

  await membership.save();
  return { membership, previousRole, previousPermissions };
}

async function deactivateTenantUser(tenantId, userId, deactivatedBy) {
  const { membership } = await updateTenantUser(tenantId, userId, { isActive: false }, deactivatedBy);
  return membership;
}

// Admin-initiated password reset (Users.js's "Reset Password" row action) - distinct from
// the self-service Forgot Password flow (authController.js forgotPassword/resetPassword),
// but deliberately reuses the same primitives: generateTemporaryPassword() (already used for
// new-user invites, same format), User's pre-save hash hook (`user.password = x; save()`),
// and RefreshToken.revokeAllForUser (same "a password change must not leave old sessions
// valid" rule the self-service reset already enforces).
//
// UX choice (confirmed): generates a temporary password and returns it for the admin to
// share via the same one-time-credentials dialog already used for Invite - not a
// forced-change-on-next-login flow (that would need a new mustChangePassword field + login
// gate + forced-change screen, none of which exist yet - flagged as a separate, larger
// follow-up if true enforcement is wanted later). The user is expected to change it
// themselves via the existing self-service /change-password page.
async function resetTenantUserPassword(tenantId, userId) {
  const membership = await TenantUser.findOne({ tenantId, userId }).populate('userId', 'username email fullName isActive');
  if (!membership) {
    throw new TenantUserServiceError('Tenant user not found', 404, 'TENANT_USER_NOT_FOUND');
  }

  const user = membership.userId;
  if (!user || !user.isActive) {
    throw new TenantUserServiceError('User account is not active', 400, 'USER_INACTIVE');
  }

  const temporaryPassword = generateTemporaryPassword();
  const targetUser = await User.findById(user._id);
  targetUser.password = temporaryPassword; // rehashed by User's pre-save hook
  await targetUser.save();

  // Compromised-credential defense, same as the self-service reset flow: an admin-forced
  // password change must not leave any session still valid under the old password.
  await RefreshToken.revokeAllForUser(targetUser._id);

  return {
    membership,
    credentials: {
      username: targetUser.username,
      email: targetUser.email,
      temporaryPassword
    }
  };
}

module.exports = {
  TenantUserServiceError,
  listTenantUsers,
  createTenantUser,
  updateTenantUser,
  deactivateTenantUser,
  resetTenantUserPassword,
  toPublicTenantUser
};
