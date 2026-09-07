const request = require('supertest');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');
const User = require('../../src/models/User');
const AuditLog = require('../../src/models/AuditLog');

// The runtime host isn't reachable from this test environment, so the SSH
// layer is stubbed here — these tests verify the portal-side lifecycle
// (auth, status transitions, audit logging), not a real SSH/script run.
jest.mock('../../src/utils/runtimeSshClient', () => {
  const actual = jest.requireActual('../../src/utils/runtimeSshClient');
  return {
    ...actual,
    provisionTenantViaSsh: jest.fn(async (tenantCode) => ({
      success: true,
      stdout: `role tenant_${tenantCode} and database fineract_tenant_${tenantCode} created\n`,
      stderr: '',
    })),
  };
});

// Real SMTP isn't reachable/desirable from the test suite — the relay
// itself was verified live separately (see docs/RUNTIME_PROVISIONING.md).
jest.mock('../../src/utils/emailService', () => ({
  sendEmail: jest.fn(async () => ({ messageId: 'test-message-id', accepted: [] })),
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

  it('creates and provisions a tenant by SSH-triggering provision_tenant.sh, auditing each step', async () => {
    const createRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'acme_bank', tenantName: 'Acme Bank', contactFirstName: 'Amina', contactSurname: 'Hassan', contactEmail: 'amina.hassan@example.com', contactPhone: '+255712345678' });
    expect(createRes.status).toBe(201);

    const provisionRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants/acme_bank/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(provisionRes.status).toBe(202);
    expect(provisionRes.body.data.tenant.status).toBe('ready');
    expect(provisionRes.body.data.tenant.databaseName).toBe('fineract_tenant_acme_bank');

    const logs = await AuditLog.find({ tenantId: 'acme_bank' }).sort({ createdAt: 1 });
    expect(logs.map((l) => l.action)).toEqual(
      expect.arrayContaining(['runtime_tenant_create', 'runtime_tenant_provision'])
    );
  });

  it('rejects a tenantId that does not match the runtime host tenant-code format', async () => {
    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'Not-A-Valid-Code!', tenantName: 'Bad Code Tenant' });
    expect(res.status).toBe(400);
  });

  it('returns 501 for bootstrap and activate, which are not yet implemented', async () => {
    await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'unfinished_tenant', tenantName: 'Unfinished Tenant', contactFirstName: 'Amina', contactSurname: 'Hassan', contactEmail: 'amina.hassan@example.com', contactPhone: '+255712345678' });

    const bootstrapRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants/unfinished_tenant/bootstrap')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(bootstrapRes.status).toBe(501);

    const activateRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants/unfinished_tenant/activate')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(activateRes.status).toBe(501);
  });
});
