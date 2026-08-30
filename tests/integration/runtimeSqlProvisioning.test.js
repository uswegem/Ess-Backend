const request = require('supertest');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');
const User = require('../../src/models/User');
const AuditLog = require('../../src/models/AuditLog');

// The runtime host itself (a separate physical Postgres instance) isn't
// reachable from this test environment, so the SQL execution layer is
// stubbed here — these tests verify the portal-side lifecycle (auth,
// status transitions, audit logging), not real Postgres connectivity.
jest.mock('../../src/utils/runtimeSqlBootstrap', () => ({
  ensureRuntimeDatabaseAndSchema: jest.fn(async ({ tenantId, databaseName, schemaName }) => ({
    success: true,
    databaseName: databaseName || `${tenantId}_db`,
    schemaName: schemaName || `${tenantId}_schema`,
  })),
  executeRuntimeBootstrapSql: jest.fn(async ({ tenantId, adminUsername }) => ({
    success: true,
    databaseCreated: true,
    schemaApplied: true,
    adminUserCreated: true,
    tenantId,
    adminUsername,
  })),
  markRuntimeTenantActive: jest.fn(async () => ({ success: true })),
}));

describe('Runtime host provisioning lifecycle (via API)', () => {
  let app;
  let token;

  beforeEach(async () => {
    app = buildM4TestApp();
    await User.create({
      username: 'superadmin',
      email: 'super@test.com',
      password: 'TestPassword123!',
      fullName: 'Super Admin',
      role: 'super_admin',
      isActive: true
    });
    token = await loginSuperAdmin(app);
  });

  it('walks a tenant through create -> provision -> bootstrap -> activate, auditing each step', async () => {
    const createRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'lifecycle-tenant', tenantName: 'Lifecycle Tenant', runtimeHost: '102.204.1.22' });
    expect(createRes.status).toBe(201);

    const provisionRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants/lifecycle-tenant/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(provisionRes.status).toBe(202);
    expect(provisionRes.body.data.tenant.status).toBe('ready');

    const bootstrapRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants/lifecycle-tenant/bootstrap')
      .set('Authorization', `Bearer ${token}`)
      .send({ adminUsername: 'lifecycle-admin', adminEmail: 'admin@lifecycle.local', adminPassword: 'StrongPass1!' });
    expect(bootstrapRes.status).toBe(200);
    expect(bootstrapRes.body.data.tenant.bootstrap.adminUserCreated).toBe(true);

    const activateRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants/lifecycle-tenant/activate')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.tenant.status).toBe('ready');

    const logs = await AuditLog.find({ tenantId: 'lifecycle-tenant' }).sort({ createdAt: 1 });
    const actions = logs.map((l) => l.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'runtime_tenant_create',
        'runtime_tenant_provision',
        'runtime_tenant_bootstrap',
        'runtime_tenant_activate',
      ])
    );
  });
});
