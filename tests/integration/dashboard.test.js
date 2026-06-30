const request = require('supertest');
const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const MessageLog = require('../../src/models/MessageLog');
const { buildM5TestApp, loginSuperAdmin } = require('./m4TestHelper');

const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHBfpEDwNJTMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCXRl
c3QtY2VydDAeFw0yNTAxMDEwMDAwMDBaFw0yNjAxMDEwMDAwMDBaMBQxEjAQBgNV
BAMMCXRlc3QtY2VydDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABGsamplekey
-----END CERTIFICATE-----`;

const SAMPLE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCsamplekey
-----END PRIVATE KEY-----`;

describe('Dashboard API (M5)', () => {
  let app;
  let token;

  beforeEach(async () => {
    app = buildM5TestApp();
    await User.create({
      username: 'superadmin',
      email: 'super@test.com',
      password: 'TestPassword123!',
      fullName: 'Super Admin',
      role: 'super_admin',
      isActive: true,
    });
    token = await loginSuperAdmin(app);
  });

  it('GET /api/v1/dashboard/overview returns KPIs', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.overview).toBeDefined();
    expect(res.body.data.loanStatistics.essSummary).toHaveLength(6);
  });

  it('GET /api/v1/dashboard/activity returns logs', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/activity')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.logs).toBeDefined();
  });

  it('GET /api/v1/dashboard/messages counts pending and failed messages', async () => {
    const tenant = await Tenant.create({
      tenantId: 'msg-tenant',
      tenantName: 'Msg FSP',
      fspCode: 'MSG01',
      fspName: 'Msg FSP',
      contactPerson: 'Admin',
      contactEmail: 'msg@test.com',
      contactPhone: '+255700000099',
      status: 'active',
    });

    await MessageLog.create({
      tenantId: tenant.tenantId,
      messageId: 'msg-1',
      messageType: 'RESPONSE',
      status: 'pending',
      xmlPayload: '<xml/>',
    });
    await MessageLog.create({
      tenantId: tenant.tenantId,
      messageId: 'msg-2',
      messageType: 'RESPONSE',
      status: 'failed',
      xmlPayload: '<xml/>',
    });
    await MessageLog.create({
      tenantId: tenant.tenantId,
      messageId: 'msg-3',
      messageType: 'RESPONSE',
      status: 'sent',
      xmlPayload: '<xml/>',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/messages')
      .query({ tenantId: tenant.tenantId })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pendingCount).toBe(2);
  });
});

describe('Tenant certificates API (M5)', () => {
  let app;
  let token;
  let tenantId;

  beforeEach(async () => {
    app = buildM5TestApp();
    await User.create({
      username: 'superadmin',
      email: 'super@test.com',
      password: 'TestPassword123!',
      fullName: 'Super Admin',
      role: 'super_admin',
      isActive: true,
    });
    token = await loginSuperAdmin(app);

    const created = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantName: 'Cert FSP',
        fspCode: 'CERT01',
        fspName: 'Cert FSP',
        contactPerson: 'Admin',
        contactEmail: 'cert@test.com',
        contactPhone: '+255700000001',
      });
    tenantId = created.body.data.tenant.tenantId;
  });

  it('uploads and retrieves certificate metadata', async () => {
    const upload = await request(app)
      .post(`/api/v1/tenants/${tenantId}/certificates`)
      .set('Authorization', `Bearer ${token}`)
      .attach('publicCert', Buffer.from(SAMPLE_CERT), 'public.pem')
      .attach('privateKey', Buffer.from(SAMPLE_KEY), 'private.pem');

    expect(upload.status).toBe(200);
    expect(upload.body.data.certificateFingerprint).toBeTruthy();

    const get = await request(app)
      .get(`/api/v1/tenants/${tenantId}/certificates`)
      .set('Authorization', `Bearer ${token}`);

    expect(get.status).toBe(200);
    expect(get.body.data.hasCertificates).toBe(true);

    const del = await request(app)
      .delete(`/api/v1/tenants/${tenantId}/certificates`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);

    const afterDelete = await request(app)
      .get(`/api/v1/tenants/${tenantId}/certificates`)
      .set('Authorization', `Bearer ${token}`);

    expect(afterDelete.status).toBe(200);
    expect(afterDelete.body.data.hasCertificates).toBe(false);
  });
});
