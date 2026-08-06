const User = require('../models/User');
const TenantUser = require('../models/TenantUser');
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

async function updateTenantUser(tenantId, userId, payload) {
  const membership = await TenantUser.findOne({ tenantId, userId }).populate('userId', 'username email fullName phone');
  if (!membership) {
    throw new TenantUserServiceError('Tenant user not found', 404, 'TENANT_USER_NOT_FOUND');
  }

  if (payload.role) membership.role = payload.role;
  if (payload.permissions) membership.permissions = payload.permissions;
  if (payload.isActive === false) {
    membership.isActive = false;
    membership.deactivatedAt = new Date();
  } else if (payload.isActive === true) {
    membership.isActive = true;
    membership.deactivatedAt = undefined;
    membership.activatedAt = new Date();
  }

  await membership.save();
  return membership;
}

async function deactivateTenantUser(tenantId, userId, deactivatedBy) {
  return updateTenantUser(tenantId, userId, { isActive: false }, deactivatedBy);
}

module.exports = {
  TenantUserServiceError,
  listTenantUsers,
  createTenantUser,
  updateTenantUser,
  deactivateTenantUser,
  toPublicTenantUser
};
