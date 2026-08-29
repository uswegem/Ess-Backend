const MiracoreTenant = require('../models/MiracoreTenant');
const { provisionRuntimeTenant, bootstrapRuntimeTenant, activateRuntimeTenant } = require('./miracoreRuntimeClient');

class MiracoreTenantServiceError extends Error {
  constructor(message, statusCode = 400, code = 'MIRACORE_TENANT_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function listMiracoreTenants({ page = 1, limit = 20, status, search } = {}) {
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
    MiracoreTenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    MiracoreTenant.countDocuments(filter),
  ]);

  return {
    tenants: tenants.map((tenant) => tenant.toSafeJSON()),
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) || 1 },
  };
}

async function createMiracoreTenant(payload, { createdBy } = {}) {
  const tenantId = payload.tenantId || `miracore-${Date.now()}`;
  const existing = await MiracoreTenant.findOne({ tenantId });
  if (existing) {
    throw new MiracoreTenantServiceError('Miracore tenant already exists', 409, 'DUPLICATE_MIRACORE_TENANT');
  }

  const tenant = await MiracoreTenant.create({
    ...payload,
    tenantId,
    createdBy,
    status: payload.status || 'provisioning',
    appConfig: payload.appConfig || {},
    notificationConfig: payload.notificationConfig || {},
  });

  return tenant;
}

async function getMiracoreTenant(tenantId) {
  const tenant = await MiracoreTenant.findOne({ tenantId });
  if (!tenant) {
    throw new MiracoreTenantServiceError('Miracore tenant not found', 404, 'MIRACORE_TENANT_NOT_FOUND');
  }
  return tenant;
}

async function updateMiracoreTenant(tenantId, payload, { updatedBy } = {}) {
  const tenant = await getMiracoreTenant(tenantId);

  Object.keys(payload || {}).forEach((key) => {
    if (key === 'tenantId') return;
    if (payload[key] !== undefined) {
      tenant[key] = payload[key];
    }
  });

  if (updatedBy) tenant.updatedBy = updatedBy;
  await tenant.save();
  return tenant;
}

async function provisionMiracoreTenant(tenantId) {
  const tenant = await getMiracoreTenant(tenantId);
  const jobId = `miracore-${tenantId}-${Date.now()}`;

  tenant.status = 'provisioning';
  tenant.provisioningJob = {
    jobId,
    status: 'queued',
    startedAt: new Date(),
  };
  await tenant.save();

  const result = await provisionRuntimeTenant(tenant, {
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    databaseName: tenant.databaseName,
    schemaName: tenant.schemaName,
    appConfig: tenant.appConfig,
    notificationConfig: tenant.notificationConfig,
  });

  tenant.provisioningJob = {
    ...(tenant.provisioningJob || {}),
    status: result.success ? 'completed' : 'failed',
    finishedAt: new Date(),
    lastError: result.success ? undefined : result.error,
  };
  tenant.status = result.success ? 'ready' : 'failed';
  await tenant.save();

  return tenant;
}

async function bootstrapMiracoreTenant(tenantId, payload = {}) {
  const tenant = await getMiracoreTenant(tenantId);

  const bootstrapPayload = {
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    databaseName: tenant.databaseName,
    schemaName: tenant.schemaName,
    adminUsername: payload.adminUsername || `${tenant.tenantId}-admin`,
    adminEmail: payload.adminEmail || `${tenant.tenantId}@local.test`,
    adminPassword: payload.adminPassword || 'AdminPass123!',
    runtimeHost: tenant.runtimeHost,
    runtimePort: tenant.runtimePort,
  };

  tenant.bootstrap = {
    status: 'running',
    startedAt: new Date(),
    databaseCreated: false,
    schemaApplied: false,
    adminUserCreated: false,
    adminUsername: bootstrapPayload.adminUsername,
    lastError: null,
  };
  await tenant.save();

  const result = await bootstrapRuntimeTenant(tenant, bootstrapPayload);

  const remoteData = result.data || {};
  tenant.bootstrap = {
    ...tenant.bootstrap,
    status: result.success ? 'completed' : 'failed',
    finishedAt: new Date(),
    databaseCreated: Boolean(remoteData.databaseCreated || remoteData.steps?.databaseCreated),
    schemaApplied: Boolean(remoteData.schemaApplied || remoteData.steps?.schemaApplied),
    adminUserCreated: Boolean(remoteData.adminUserCreated || remoteData.steps?.adminUserCreated),
    adminUsername: remoteData.adminUsername || bootstrapPayload.adminUsername,
    lastError: result.success ? null : result.error,
  };
  tenant.status = result.success ? 'ready' : 'failed';
  await tenant.save();

  return tenant;
}

async function activateMiracoreTenant(tenantId) {
  const tenant = await getMiracoreTenant(tenantId);
  const result = await activateRuntimeTenant(tenant, {
    tenantId: tenant.tenantId,
    runtimeHost: tenant.runtimeHost,
    runtimePort: tenant.runtimePort,
    databaseName: tenant.databaseName,
    schemaName: tenant.schemaName,
  });

  tenant.status = result.success ? 'ready' : 'failed';
  if (result.success) {
    tenant.bootstrap = {
      ...(tenant.bootstrap || {}),
      status: 'completed',
      finishedAt: new Date(),
    };
  }
  await tenant.save();

  return tenant;
}

module.exports = {
  MiracoreTenantServiceError,
  listMiracoreTenants,
  createMiracoreTenant,
  getMiracoreTenant,
  updateMiracoreTenant,
  provisionMiracoreTenant,
  bootstrapMiracoreTenant,
  activateMiracoreTenant,
};
