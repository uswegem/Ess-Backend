const request = require('supertest');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');
const User = require('../../src/models/User');

describe('Miracore provisioning module', () => {
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

  it('creates and lists a MiraCore tenant provisioning record', async () => {
    const createRes = await request(app)
      .post('/api/v1/miracore/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: 'mira-demo',
        tenantName: 'Mira Demo',
        runtimeHost: '102.204.1.22',
        runtimePort: 3002,
        databaseName: 'mira_demo_db',
        schemaName: 'mira_demo',
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
    expect(createRes.body.data.tenant.tenantId).toBe('mira-demo');
    expect(createRes.body.data.tenant.status).toBe('provisioning');

    const listRes = await request(app)
      .get('/api/v1/miracore/tenants')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.tenants.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data.tenants[0].tenantId).toBe('mira-demo');
  });
});
