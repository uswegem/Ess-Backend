const request = require('supertest');
const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const TenantUser = require('../../src/models/TenantUser');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');

describe('Tenant CRUD integration', () => {
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

  it('creates a tenant', async () => {
    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantName: 'New FSP',
        fspCode: 'NEWFSP01',
        fspName: 'New FSP Ltd',
        contactPerson: 'John Doe',
        contactEmail: 'john@newfsp.com',
        contactPhone: '+255700000099'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenant.fspCode).toBe('NEWFSP01');
    expect(res.body.data.tenant.status).toBe('draft');
  });

  it('returns 409 for duplicate fspCode', async () => {
    const payload = {
      tenantName: 'Dup FSP',
      fspCode: 'DUPFSP01',
      fspName: 'Dup FSP',
      contactPerson: 'Jane',
      contactEmail: 'jane@dup.com',
      contactPhone: '+255700000088'
    };

    await request(app).post('/api/v1/tenants').set('Authorization', `Bearer ${token}`).send(payload);
    const res = await request(app).post('/api/v1/tenants').set('Authorization', `Bearer ${token}`).send({
      ...payload,
      tenantName: 'Dup FSP 2',
      contactEmail: 'jane2@dup.com'
    });

    expect(res.status).toBe(409);
  });

  it('lists tenants', async () => {
    await Tenant.create({
      tenantId: 'list-tenant',
      tenantName: 'List Tenant',
      fspCode: 'LIST01',
      fspName: 'List FSP',
      contactPerson: 'A',
      contactEmail: 'a@list.com',
      contactPhone: '+255700000001',
      status: 'active'
    });

    const res = await request(app)
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tenants.length).toBeGreaterThanOrEqual(1);
  });

  it('gets tenant by id', async () => {
    await Tenant.create({
      tenantId: 'get-tenant',
      tenantName: 'Get Tenant',
      fspCode: 'GET01',
      fspName: 'Get FSP',
      contactPerson: 'A',
      contactEmail: 'a@get.com',
      contactPhone: '+255700000001',
      status: 'active'
    });

    const res = await request(app)
      .get('/api/v1/tenants/get-tenant')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tenant.tenantId).toBe('get-tenant');
  });

  it('updates tenant', async () => {
    await Tenant.create({
      tenantId: 'upd-tenant',
      tenantName: 'Old Name',
      fspCode: 'UPD01',
      fspName: 'Upd FSP',
      contactPerson: 'A',
      contactEmail: 'a@upd.com',
      contactPhone: '+255700000001',
      status: 'draft'
    });

    const res = await request(app)
      .put('/api/v1/tenants/upd-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantName: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.tenant.tenantName).toBe('New Name');
  });

  it('patches tenant status', async () => {
    await Tenant.create({
      tenantId: 'status-tenant',
      tenantName: 'Status Tenant',
      fspCode: 'STAT01',
      fspName: 'Status FSP',
      contactPerson: 'A',
      contactEmail: 'a@stat.com',
      contactPhone: '+255700000001',
      status: 'approved',
      mifosConfig: { mode: 'inherit_default', isConfigured: true }
    });

    const res = await request(app)
      .patch('/api/v1/tenants/status-tenant/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.data.tenant.status).toBe('active');
  });

  it('rejects unauthorized tenant create', async () => {
    const user = await User.create({
      username: 'regular',
      email: 'regular@test.com',
      password: 'TestPassword123!',
      fullName: 'Regular',
      role: 'user',
      isActive: true
    });
    const userToken = await loginSuperAdmin(app, 'regular', 'TestPassword123!');

    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        tenantName: 'X',
        fspCode: 'X01',
        fspName: 'X',
        contactPerson: 'X',
        contactEmail: 'x@x.com',
        contactPhone: '+255700000001'
      });

    expect(res.status).toBe(403);
  });
});
