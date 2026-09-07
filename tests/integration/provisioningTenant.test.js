const request = require('supertest');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');
const User = require('../../src/models/User');

const VALID_CONTACT = {
  contactFirstName: 'Amina',
  contactSurname: 'Hassan',
  contactEmail: 'amina.hassan@example.com',
  contactPhone: '+255712345678',
};

jest.mock('../../src/utils/emailService', () => ({
  sendEmail: jest.fn(async () => ({ messageId: 'test-message-id', accepted: ['amina.hassan@example.com'] })),
}));

describe('Runtime provisioning tenant module', () => {
  let app;
  let token;

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it('creates and lists a runtime provisioning tenant record, and sends the request-received email', async () => {
    const { sendEmail } = require('../../src/utils/emailService');
    const createRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: 'demo_tenant',
        tenantName: 'Demo Tenant',
        ...VALID_CONTACT,
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
    expect(createRes.body.data.tenant.contactEmail).toBe('amina.hassan@example.com');

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: 'amina.hassan@example.com' });
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/request received/i);
    expect(sendEmail.mock.calls[0][0].text).not.toMatch(/password/i);

    const listRes = await request(app)
      .get('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.tenants.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data.tenants[0].tenantId).toBe('demo_tenant');
  });

  it('does not fail tenant creation if the email send fails', async () => {
    const { sendEmail } = require('../../src/utils/emailService');
    sendEmail.mockRejectedValueOnce(new Error('SMTP relay unreachable'));

    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'email_fail_tenant', tenantName: 'Email Fail Tenant', ...VALID_CONTACT });

    expect(res.status).toBe(201);
  });

  it('rejects a tenantId that does not match the runtime host tenant-code format', async () => {
    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'Not-A-Valid-Code!', tenantName: 'Bad Code Tenant', ...VALID_CONTACT });

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
        ...VALID_CONTACT,
      });

    expect(res.status).toBe(400);
  });

  it('rejects missing contact fields', async () => {
    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'no_contact_tenant', tenantName: 'No Contact Tenant' });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid contact email', async () => {
    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: 'bad_email_tenant',
        tenantName: 'Bad Email Tenant',
        ...VALID_CONTACT,
        contactEmail: 'not-an-email',
      });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid contact phone number', async () => {
    const res = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: 'bad_phone_tenant',
        tenantName: 'Bad Phone Tenant',
        ...VALID_CONTACT,
        contactPhone: 'call-me-maybe',
      });

    expect(res.status).toBe(400);
  });

  it('auto-renames a colliding tenantId at create time (safety net) rather than erroring', async () => {
    await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'madaba', tenantName: 'Madaba Microfinance', ...VALID_CONTACT });

    const secondRes = await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'madaba', tenantName: 'Madaba Microfinance Branch 2', ...VALID_CONTACT });

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.data.tenant.tenantId).toBe('madaba2');
  });

  it('the check-tenant-id endpoint reports availability and suggests the next free slug on collision', async () => {
    await request(app)
      .post('/api/v1/runtime-provisioning/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'taken_slug', tenantName: 'Taken Slug Tenant', ...VALID_CONTACT });

    const freeRes = await request(app)
      .get('/api/v1/runtime-provisioning/tenants/check-tenant-id?slug=totally_free_slug')
      .set('Authorization', `Bearer ${token}`);
    expect(freeRes.status).toBe(200);
    expect(freeRes.body.data.tenantId).toBe('totally_free_slug');
    expect(freeRes.body.data.wasRenamed).toBe(false);

    const collidingRes = await request(app)
      .get('/api/v1/runtime-provisioning/tenants/check-tenant-id?slug=taken_slug')
      .set('Authorization', `Bearer ${token}`);
    expect(collidingRes.status).toBe(200);
    expect(collidingRes.body.data.tenantId).toBe('taken_slug2');
    expect(collidingRes.body.data.wasRenamed).toBe(true);
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
