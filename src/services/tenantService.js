const Tenant = require('../models/Tenant');
const {
  applyTransition,
  TenantStatusError
} = require('./tenantStatusService');
const { assertReadyForActivation, isMifosConfigured } = require('./mifosConfigService');

class TenantServiceError extends Error {
  constructor(message, statusCode = 400, code = 'TENANT_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function slugifyTenantId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 62) || `fsp-${Date.now()}`;
}

async function generateUniqueTenantId(base) {
  let candidate = slugifyTenantId(base);
  if (candidate.length < 3) candidate = `fsp-${candidate}`;

  let suffix = 0;
  while (await Tenant.exists({ tenantId: candidate })) {
    suffix += 1;
    candidate = `${slugifyTenantId(base).slice(0, 55)}-${suffix}`;
  }
  return candidate;
}

function toPublicMifosConfig(tenant) {
  const obj = tenant.toSafeJSON ? tenant.toSafeJSON() : tenant.toObject?.() || tenant;
  const cfg = obj.mifosConfig || {};
  const mode = cfg.mode || 'inherit_default';

  if (mode === 'inherit_default') {
    return { mode: 'inherit_default' };
  }

  return {
    mode: 'override',
    baseUrl: cfg.baseUrl || '',
    tenantId: cfg.tenantId || '',
    makerUsername: cfg.makerUsername || '',
    checkerUsername: cfg.checkerUsername || cfg.makerUsername || '',
    callbackUrl: cfg.callbackUrl || '',
    timeoutMs: cfg.timeoutMs,
    isConfigured: Boolean(cfg.isConfigured),
    lastValidatedAt: cfg.lastValidatedAt || null,
    hasMakerPassword: Boolean(cfg.makerPasswordEncrypted),
    hasCheckerPassword: Boolean(cfg.checkerPasswordEncrypted)
  };
}

function toPublicTenant(tenant) {
  const obj = tenant.toSafeJSON ? tenant.toSafeJSON() : tenant.toObject();
  return {
    id: obj._id,
    tenantId: obj.tenantId,
    tenantName: obj.tenantName,
    fspCode: obj.fspCode,
    fspName: obj.fspName,
    contactPerson: obj.contactPerson,
    contactEmail: obj.contactEmail,
    contactPhone: obj.contactPhone,
    organizationRegistrationNumber: obj.organizationRegistrationNumber,
    address: obj.address,
    status: obj.status,
    onboarding: obj.onboarding,
    mifosConfigured: isMifosConfigured(tenant),
    mifosConfig: toPublicMifosConfig(tenant),
    subscription: obj.subscription,
    metadata: obj.metadata,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
}

async function createTenant(payload, { createdBy, status = 'draft' } = {}) {
  const tenantId = payload.tenantId || await generateUniqueTenantId(payload.fspCode || payload.tenantName);

  const existingFsp = await Tenant.findOne({ fspCode: payload.fspCode.toUpperCase() });
  if (existingFsp) {
    throw new TenantServiceError('FSP code already exists', 409, 'DUPLICATE_FSP_CODE');
  }

  const existingId = await Tenant.findOne({ tenantId });
  if (existingId) {
    throw new TenantServiceError('tenantId already exists', 409, 'DUPLICATE_TENANT_ID');
  }

  const tenant = await Tenant.create({
    ...payload,
    tenantId,
    fspCode: payload.fspCode.toUpperCase(),
    status,
    createdBy,
    onboarding: status === 'draft' ? {
      draftExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      completedSteps: []
    } : undefined
  });

  return tenant;
}

async function listTenants({ page = 1, limit = 20, status, search, scopedTenantId }) {
  const filter = {};
  if (scopedTenantId) filter.tenantId = scopedTenantId;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { tenantName: new RegExp(search, 'i') },
      { fspCode: new RegExp(search, 'i') },
      { tenantId: new RegExp(search, 'i') }
    ];
  }

  const skip = (page - 1) * limit;
  const [tenants, total] = await Promise.all([
    Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Tenant.countDocuments(filter)
  ]);

  return {
    tenants: tenants.map(toPublicTenant),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function getTenantById(tenantId) {
  const tenant = await Tenant.findOne({ tenantId });
  if (!tenant) {
    throw new TenantServiceError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  }
  return tenant;
}

async function updateTenant(tenantId, payload, updatedBy) {
  const tenant = await getTenantById(tenantId);

  if (tenant.status === 'active' && payload.fspCode && payload.fspCode !== tenant.fspCode) {
    throw new TenantServiceError('fspCode is immutable after activation', 400, 'IMMUTABLE_FIELD');
  }

  const fields = [
    'tenantName', 'fspName', 'contactPerson', 'contactEmail', 'contactPhone',
    'organizationRegistrationNumber', 'address', 'subscription', 'metadata'
  ];

  if (tenant.status !== 'active' && payload.fspCode) {
    const dup = await Tenant.findOne({ fspCode: payload.fspCode.toUpperCase(), tenantId: { $ne: tenantId } });
    if (dup) throw new TenantServiceError('FSP code already exists', 409, 'DUPLICATE_FSP_CODE');
    tenant.fspCode = payload.fspCode.toUpperCase();
  }

  fields.forEach((field) => {
    if (payload[field] !== undefined) tenant[field] = payload[field];
  });

  if (updatedBy) tenant.updatedBy = updatedBy;
  await tenant.save();
  return tenant;
}

async function patchTenantStatus(tenantId, nextStatus, { reason, reviewedBy } = {}) {
  const tenant = await getTenantById(tenantId);

  if (nextStatus === 'active') {
    await assertReadyForActivation(tenant);
  }

  try {
    applyTransition(tenant, nextStatus, { reason, reviewedBy });
  } catch (error) {
    if (error instanceof TenantStatusError) {
      throw new TenantServiceError(error.message, 400, error.code);
    }
    throw error;
  }

  await tenant.save();
  return tenant;
}

async function isFspCodeAvailable(fspCode, excludeTenantId) {
  const filter = { fspCode: fspCode.toUpperCase() };
  if (excludeTenantId) filter.tenantId = { $ne: excludeTenantId };
  const existing = await Tenant.findOne(filter);
  return !existing;
}

module.exports = {
  TenantServiceError,
  toPublicMifosConfig,
  toPublicTenant,
  createTenant,
  listTenants,
  getTenantById,
  updateTenant,
  patchTenantStatus,
  isFspCodeAvailable,
  generateUniqueTenantId
};
