const bcrypt = require('bcryptjs');
const ProvisioningTenant = require('../models/ProvisioningTenant');
const AuditLog = require('../models/AuditLog');
const {
  ensureRuntimeDatabaseAndSchema,
  executeRuntimeBootstrapSql,
  markRuntimeTenantActive,
} = require('../utils/runtimeSqlBootstrap');

const BCRYPT_ROUNDS = 10; // matches src/utils/tenantSecretCrypto.js
const MIN_PASSWORD_LENGTH = 6; // matches src/models/User.js password minlength

class ProvisioningTenantServiceError extends Error {
  constructor(message, statusCode = 400, code = 'PROVISIONING_TENANT_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Runtime host provisioning talks directly to the runtime host's own
// Postgres instance (a genuinely separate, PostgreSQL-backed installation —
// distinct from the live MySQL-backed zedone.miracore.app Fineract instance
// that the rest of this app talks to via CBS_BASE_URL/MIFOS_*). There is no
// assumed REST API on the runtime host; RUNTIME_DB_* config points straight
// at its database.

async function logAudit({ action, description, actorUserId, tenantId, status, metadata }) {
  try {
    await AuditLog.create({
      action,
      description,
      userId: actorUserId,
      tenantId,
      status: status || 'success',
      metadata,
    });
  } catch (error) {
    // Audit logging must never block or crash the provisioning flow itself,
    // but a failure here should be visible in logs.
    // eslint-disable-next-line no-console
    console.error('Failed to write provisioning audit log', error.message);
  }
}

async function listProvisioningTenants({ page = 1, limit = 20, status, search } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { tenantId: new RegExp(search, 'i') },
      { tenantName: new RegExp(search, 'i') },
      { runtimeHost: new RegExp(search, 'i') },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [tenants, total] = await Promise.all([
    ProvisioningTenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    ProvisioningTenant.countDocuments(filter),
  ]);

  return {
    tenants: tenants.map((tenant) => tenant.toSafeJSON()),
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) || 1 },
  };
}

async function createProvisioningTenant(payload, { createdBy } = {}) {
  const tenantId = payload.tenantId || `tenant-${Date.now()}`;
  const existing = await ProvisioningTenant.findOne({ tenantId });
  if (existing) {
    throw new ProvisioningTenantServiceError('Provisioning tenant already exists', 409, 'DUPLICATE_PROVISIONING_TENANT');
  }

  const tenant = await ProvisioningTenant.create({
    ...payload,
    tenantId,
    createdBy,
    status: payload.status || 'draft',
    appConfig: payload.appConfig || {},
    notificationConfig: payload.notificationConfig || {},
  });

  await logAudit({
    action: 'runtime_tenant_create',
    description: `Runtime provisioning tenant created: ${tenant.tenantId}`,
    actorUserId: createdBy,
    tenantId: tenant.tenantId,
  });

  return tenant;
}

async function getProvisioningTenant(tenantId) {
  const tenant = await ProvisioningTenant.findOne({ tenantId });
  if (!tenant) {
    throw new ProvisioningTenantServiceError('Provisioning tenant not found', 404, 'PROVISIONING_TENANT_NOT_FOUND');
  }
  return tenant;
}

async function updateProvisioningTenant(tenantId, payload, { updatedBy } = {}) {
  const tenant = await getProvisioningTenant(tenantId);

  Object.keys(payload || {}).forEach((key) => {
    if (key === 'tenantId') return;
    if (payload[key] !== undefined) {
      tenant[key] = payload[key];
    }
  });

  if (updatedBy) tenant.updatedBy = updatedBy;
  await tenant.save();

  await logAudit({
    action: 'runtime_tenant_update',
    description: `Runtime provisioning tenant updated: ${tenant.tenantId}`,
    actorUserId: updatedBy,
    tenantId: tenant.tenantId,
  });

  return tenant;
}

// Step 1 of 3: prove the runtime host's Postgres is reachable and stand up
// the database/schema shell. Idempotent — re-provisioning a 'ready' tenant
// is a no-op so a retried request doesn't re-run against live state.
async function provisionProvisioningTenant(tenantId, { actorUserId } = {}) {
  const tenant = await getProvisioningTenant(tenantId);
  const jobId = `provision-${tenantId}-${Date.now()}`;

  if (tenant.status === 'ready') {
    return tenant;
  }

  tenant.status = 'provisioning';
  tenant.provisioningJob = { jobId, status: 'queued', startedAt: new Date() };
  await tenant.save();

  const result = await ensureRuntimeDatabaseAndSchema({
    tenantId: tenant.tenantId,
    databaseName: tenant.databaseName,
    schemaName: tenant.schemaName,
  });

  if (result.success) {
    tenant.databaseName = result.databaseName;
    tenant.schemaName = result.schemaName;
  }

  tenant.provisioningJob = {
    ...(tenant.provisioningJob || {}),
    status: result.success ? 'completed' : 'failed',
    finishedAt: new Date(),
    lastError: result.success ? undefined : result.error,
  };
  tenant.status = result.success ? 'ready' : 'failed';
  await tenant.save();

  await logAudit({
    action: 'runtime_tenant_provision',
    description: `Runtime provisioning ${result.success ? 'succeeded' : 'failed'} for tenant: ${tenant.tenantId}`,
    actorUserId,
    tenantId: tenant.tenantId,
    status: result.success ? 'success' : 'failed',
    metadata: result.success ? undefined : { error: result.error },
  });

  return tenant;
}

// Step 2 of 3: create the runtime-host tables and the tenant's admin user.
// The DDL uses ON CONFLICT DO NOTHING, so re-calling this after a partial
// failure is safe rather than erroring on a duplicate key.
async function bootstrapProvisioningTenant(tenantId, payload = {}, { actorUserId } = {}) {
  const tenant = await getProvisioningTenant(tenantId);

  if (!payload.adminPassword || String(payload.adminPassword).length < MIN_PASSWORD_LENGTH) {
    throw new ProvisioningTenantServiceError(
      `adminPassword is required and must be at least ${MIN_PASSWORD_LENGTH} characters`,
      400,
      'WEAK_ADMIN_PASSWORD'
    );
  }

  const adminUsername = payload.adminUsername || `${tenant.tenantId}-admin`;
  const adminEmail = payload.adminEmail || `${tenant.tenantId}@local.test`;
  // The plaintext password is hashed immediately and never persisted or
  // logged; only the hash is written to the runtime host's users table.
  const adminPasswordHash = await bcrypt.hash(payload.adminPassword, BCRYPT_ROUNDS);

  tenant.bootstrap = {
    status: 'running',
    startedAt: new Date(),
    databaseCreated: false,
    schemaApplied: false,
    adminUserCreated: false,
    adminUsername,
    lastError: null,
  };
  await tenant.save();

  const result = await executeRuntimeBootstrapSql({
    tenantId: tenant.tenantId,
    databaseName: tenant.databaseName,
    schemaName: tenant.schemaName,
    adminUsername,
    adminEmail,
    adminPasswordHash,
  });

  tenant.bootstrap = {
    ...tenant.bootstrap,
    status: result.success ? 'completed' : 'failed',
    finishedAt: new Date(),
    databaseCreated: Boolean(result.databaseCreated),
    schemaApplied: Boolean(result.schemaApplied),
    adminUserCreated: Boolean(result.adminUserCreated),
    adminUsername: result.adminUsername || adminUsername,
    lastError: result.success ? null : result.error,
  };
  tenant.status = result.success ? 'ready' : 'failed';
  await tenant.save();

  await logAudit({
    action: 'runtime_tenant_bootstrap',
    description: `Runtime bootstrap ${result.success ? 'succeeded' : 'failed'} for tenant: ${tenant.tenantId}`,
    actorUserId,
    tenantId: tenant.tenantId,
    status: result.success ? 'success' : 'failed',
    metadata: result.success ? { adminUsername } : { adminUsername, error: result.error },
  });

  return tenant;
}

// Step 3 of 3: flip the tenant's row to active on the runtime host.
// Idempotent — safe to retry.
async function activateProvisioningTenant(tenantId, { actorUserId } = {}) {
  const tenant = await getProvisioningTenant(tenantId);

  const result = await markRuntimeTenantActive({
    tenantId: tenant.tenantId,
    schemaName: tenant.schemaName,
  });

  tenant.status = result.success ? 'ready' : 'failed';
  if (result.success) {
    tenant.bootstrap = { ...(tenant.bootstrap || {}), status: 'completed', finishedAt: new Date() };
  }
  await tenant.save();

  await logAudit({
    action: 'runtime_tenant_activate',
    description: `Runtime activation ${result.success ? 'succeeded' : 'failed'} for tenant: ${tenant.tenantId}`,
    actorUserId,
    tenantId: tenant.tenantId,
    status: result.success ? 'success' : 'failed',
    metadata: result.success ? undefined : { error: result.error },
  });

  return tenant;
}

module.exports = {
  ProvisioningTenantServiceError,
  listProvisioningTenants,
  createProvisioningTenant,
  getProvisioningTenant,
  updateProvisioningTenant,
  provisionProvisioningTenant,
  bootstrapProvisioningTenant,
  activateProvisioningTenant,
};
