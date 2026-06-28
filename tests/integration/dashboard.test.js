const request = require('supertest');
const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
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
  });

  it('GET /api/v1/dashboard/activity returns logs', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/activity')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.logs).toBeDefined();
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
  });
});
