const request = require('supertest');
const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const TenantUser = require('../../src/models/TenantUser');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');

describe('API keys HTTP integration', () => {
  let app;
  let token;
  let tenant;

  beforeEach(async () => {
    app = buildM4TestApp();
    const admin = await User.create({
      username: 'superadmin',
      email: 'super@test.com',
      password: 'TestPassword123!',
      fullName: 'Super Admin',
      role: 'super_admin',
      isActive: true
    });

    tenant = await Tenant.create({
      tenantId: 'keys-tenant',
      tenantName: 'Keys Tenant',
      fspCode: 'KEY01',
      fspName: 'Keys FSP',
      contactPerson: 'A',
      contactEmail: 'a@keys.com',
      contactPhone: '+255700000001',
      status: 'active'
    });

    await TenantUser.create({
      tenantId: tenant.tenantId,
      tenant: tenant._id,
      userId: admin._id,
      role: 'tenant_admin',
      isActive: true
    });

    token = await loginSuperAdmin(app);
  });

  it('creates, lists, rotates, revokes, and reports usage', async () => {
    const create = await request(app)
      .post(`/api/v1/tenants/${tenant.tenantId}/api-keys`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Integration Key' });

    expect(create.status).toBe(201);
    expect(create.body.data.rawKey).toBeTruthy();
    expect(create.body.data.rawSecret).toBeTruthy();

    const keyId = create.body.data.apiKey.id || create.body.data.apiKey._id;

    const list = await request(app)
      .get(`/api/v1/tenants/${tenant.tenantId}/api-keys`)
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body.data.apiKeys[0].keyHash).toBeUndefined();
    expect(list.body.data.apiKeys[0].secretEncrypted).toBeUndefined();

    const usage = await request(app)
      .get(`/api/v1/tenants/${tenant.tenantId}/api-keys/${keyId}/usage`)
      .set('Authorization', `Bearer ${token}`);

    expect(usage.status).toBe(200);
    expect(usage.body.data.usage.usageCount).toBeDefined();

    const rotate = await request(app)
      .post(`/api/v1/tenants/${tenant.tenantId}/api-keys/${keyId}/rotate`)
      .set('Authorization', `Bearer ${token}`);

    expect(rotate.status).toBe(200);
    expect(rotate.body.data.rawKey).toBeTruthy();

    const newKeyId = rotate.body.data.apiKey.id || rotate.body.data.apiKey._id;

    const revoke = await request(app)
      .delete(`/api/v1/tenants/${tenant.tenantId}/api-keys/${newKeyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(revoke.status).toBe(200);
    expect(revoke.body.data.apiKey.status).toBe('revoked');
  });

  it('validates create key request body', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenant.tenantId}/api-keys`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
