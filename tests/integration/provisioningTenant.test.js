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
        tenantId: 'demo_tenant',
        tenantName: 'Demo Tenant',
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
    expect(createRes.body.data.tenant.tenantId).toBe('demo_tenant');
    expect(createRes.body.data.tenant.status).toBe('draft');

    const listRes = await request(app)
      .get('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.tenants.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data.tenants[0].tenantId).toBe('demo_tenant');
  });

  it('rejects a tenantId that does not match the runtime host tenant-code format', async () => {
    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'Not-A-Valid-Code!', tenantName: 'Bad Code Tenant' });

    expect(res.status).toBe(400);
  });

  it('rejects a runtime host that is not on the provisioning allowlist', async () => {
    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: 'bad_host_tenant',
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
});
