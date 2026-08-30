const request = require('supertest');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');
const User = require('../../src/models/User');

describe('Runtime provisioning tenant module', () => {
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

  it('creates and lists a runtime provisioning tenant record', async () => {
    const createRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: 'demo-tenant',
        tenantName: 'Demo Tenant',
        runtimeHost: '102.204.1.22',
        runtimePort: 3002,
        databaseName: 'demo_tenant_db',
        schemaName: 'demo_tenant',
        appConfig: {
          defaultCurrency: 'TZS',
          emailProvider: 'sendgrid',
          smsProvider: 'africastalking',
          otpProvider: 'totp'
        },
        notificationConfig: {
          emailEnabled: true,
          smsEnabled: true,
          otpEnabled: true
        }
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.tenant.tenantId).toBe('demo-tenant');
    expect(createRes.body.data.tenant.status).toBe('draft');

    const listRes = await request(app)
      .get('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.tenants.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data.tenants[0].tenantId).toBe('demo-tenant');
  });

  it('rejects a runtime host that is not on the provisioning allowlist', async () => {
    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: 'bad-host-tenant',
        tenantName: 'Bad Host Tenant',
        runtimeHost: 'zedone.miracore.app',
      });

    expect(res.status).toBe(400);
  });

  it('rejects requests from a non-admin role', async () => {
    await User.create({
      username: 'regularuser',
      email: 'regular@test.com',
      password: 'TestPassword123!',
      fullName: 'Regular User',
      role: 'user',
      isActive: true
    });
    const userLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'regularuser', password: 'TestPassword123!' });
    const userToken = userLoginRes.body.data?.token;

    const res = await request(app)
      .get('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects bootstrap without an adminPassword', async () => {
    await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'no-pass-tenant', tenantName: 'No Pass Tenant', runtimeHost: '102.204.1.22' });

    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants/no-pass-tenant/bootstrap')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
