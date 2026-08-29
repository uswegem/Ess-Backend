const bcrypt = require('bcryptjs');
const RuntimeTenant = require('../models/RuntimeTenant');
const { executeRuntimeBootstrapSql } = require('../utils/runtimeSqlBootstrap');

class RuntimeProvisioningServiceError extends Error {
  constructor(message, statusCode = 400, code = 'RUNTIME_PROVISION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function generateRuntimeTenantId(tenantId) {
  return String(tenantId || 'demo-tenant').trim();
}

function buildRuntimeMetadata(payload = {}) {
  return {
    tenantId: generateRuntimeTenantId(payload.tenantId),
    tenantName: payload.tenantName || payload.tenantId || 'Runtime Tenant',
    databaseName: payload.databaseName || `${String(payload.tenantId || 'demo').replace(/[^a-zA-Z0-9_]/g, '_')}_db`,
    schemaName: payload.schemaName || `${String(payload.tenantId || 'demo').replace(/[^a-zA-Z0-9_]/g, '_')}_schema`,
    appConfig: payload.appConfig || {},
    notificationConfig: payload.notificationConfig || {},
    provisionedAt: new Date().toISOString(),
  };
}

async function provisionRuntimeTenant(payload = {}) {
  const metadata = buildRuntimeMetadata(payload);
  const existing = await RuntimeTenant.findOne({ tenantId: metadata.tenantId });

  let tenant = existing;
  if (!tenant) {
    tenant = await RuntimeTenant.create({
      tenantId: metadata.tenantId,
      tenantName: metadata.tenantName,
      databaseName: metadata.databaseName,
      schemaName: metadata.schemaName,
      appConfig: metadata.appConfig,
      notificationConfig: metadata.notificationConfig,
      provisionedAt: new Date(),
      bootstrapStatus: 'pending',
      status: 'provisioned',
    });
  }

  return {
    success: true,
    message: 'Runtime tenant provisioned successfully',
    data: {
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      databaseName: tenant.databaseName,
      schemaName: tenant.schemaName,
      provisioned: true,
      runtimeHost: process.env.MIRACORE_RUNTIME_HOST || '102.204.1.22',
      runtimePort: Number(process.env.MIRACORE_RUNTIME_PORT || 3002),
      appConfig: tenant.appConfig,
      notificationConfig: tenant.notificationConfig,
      createdAt: tenant.provisionedAt || new Date().toISOString(),
    },
  };
}

async function bootstrapRuntimeTenant(payload = {}) {
  const tenantId = generateRuntimeTenantId(payload.tenantId);
  const databaseName = payload.databaseName || `${tenantId}_db`;
  const schemaName = payload.schemaName || `${tenantId}_schema`;
  const adminUsername = payload.adminUsername || `${tenantId}-admin`;
  const adminEmail = payload.adminEmail || `${tenantId}@local.test`;
  const adminPassword = payload.adminPassword || 'AdminPass123!';

  const sqlBootstrap = await executeRuntimeBootstrapSql({
    tenantId,
    databaseName,
    schemaName,
    adminUsername,
    adminEmail,
    adminPassword,
  });

  const tenant = await RuntimeTenant.findOneAndUpdate(
    { tenantId },
    {
      tenantId,
      tenantName: payload.tenantName || tenantId,
      databaseName,
      schemaName,
      bootstrapStartedAt: new Date(),
      bootstrapCompletedAt: new Date(),
      bootstrapStatus: sqlBootstrap.success ? 'complete' : 'failed',
      status: sqlBootstrap.success ? 'active' : 'failed',
      adminUser: {
        username: adminUsername,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    success: sqlBootstrap.success,
    message: sqlBootstrap.success ? 'Runtime tenant bootstrapped successfully' : 'Runtime tenant bootstrap failed',
    data: {
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      databaseName: tenant.databaseName,
      schemaName: tenant.schemaName,
      databaseCreated: Boolean(sqlBootstrap.databaseCreated),
      schemaApplied: Boolean(sqlBootstrap.schemaApplied),
      adminUserCreated: Boolean(sqlBootstrap.adminUserCreated),
      adminUsername: tenant.adminUser.username,
      adminEmail: tenant.adminUser.email,
      steps: {
        databaseCreated: Boolean(sqlBootstrap.databaseCreated),
        schemaApplied: Boolean(sqlBootstrap.schemaApplied),
        adminUserCreated: Boolean(sqlBootstrap.adminUserCreated),
      },
      bootstrapFinishedAt: tenant.bootstrapCompletedAt,
      generatedSql: sqlBootstrap.generatedSql,
    },
  };
}

async function activateRuntimeTenant(payload = {}) {
  const tenantId = generateRuntimeTenantId(payload.tenantId);
  const tenant = await RuntimeTenant.findOneAndUpdate(
    { tenantId },
    {
      status: 'active',
      activatedAt: new Date(),
      runtimeHost: payload.runtimeHost || process.env.MIRACORE_RUNTIME_HOST || '102.204.1.22',
      runtimePort: Number(payload.runtimePort || process.env.MIRACORE_RUNTIME_PORT || 3002),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    success: true,
    message: 'Runtime tenant activated successfully',
    data: {
      tenantId: tenant.tenantId,
      activated: true,
      status: tenant.status,
      activatedAt: tenant.activatedAt,
      runtimeHost: tenant.runtimeHost,
      runtimePort: tenant.runtimePort,
    },
  };
}

module.exports = {
  RuntimeProvisioningServiceError,
  provisionRuntimeTenant,
  bootstrapRuntimeTenant,
  activateRuntimeTenant,
};
