const request = require('supertest');
const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const TenantUser = require('../../src/models/TenantUser');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');

describe('Tenant users integration', () => {
  let app;
  let token;
  let tenant;

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

    tenant = await Tenant.create({
      tenantId: 'users-tenant',
      tenantName: 'Users Tenant',
      fspCode: 'USR01',
      fspName: 'Users FSP',
      contactPerson: 'A',
      contactEmail: 'a@users.com',
      contactPhone: '+255700000001',
      status: 'active'
    });
  });

  it('creates and lists tenant users', async () => {
    const create = await request(app)
      .post(`/api/v1/tenants/${tenant.tenantId}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer@users.com',
        fullName: 'Loan Officer',
        role: 'finance_officer'
      });

    expect(create.status).toBe(201);
    expect(create.body.data.user.role).toBe('finance_officer');
    expect(create.body.data.credentials.isNewAccount).toBe(true);
    expect(create.body.data.credentials.username).toBeTruthy();
    expect(create.body.data.credentials.temporaryPassword).toMatch(/^Tmp.+!$/);

    const list = await request(app)
      .get(`/api/v1/tenants/${tenant.tenantId}/users`)
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body.data.users.length).toBe(1);
  });

  it('updates tenant user role', async () => {
    const user = await User.create({
      username: 'member',
      email: 'member@users.com',
      password: 'TestPassword123!',
      fullName: 'Member',
      role: 'user',
      isActive: true
    });

    await TenantUser.create({
      tenantId: tenant.tenantId,
      tenant: tenant._id,
      userId: user._id,
      role: 'support_staff',
      isActive: true
    });

    const res = await request(app)
      .put(`/api/v1/tenants/${tenant.tenantId}/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'operations_manager' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('operations_manager');
  });

  it('deactivates tenant user', async () => {
    const user = await User.create({
      username: 'deact',
      email: 'deact@users.com',
      password: 'TestPassword123!',
      fullName: 'Deact',
      role: 'user',
      isActive: true
    });

    await TenantUser.create({
      tenantId: tenant.tenantId,
      tenant: tenant._id,
      userId: user._id,
      role: 'support_staff',
      isActive: true
    });

    const res = await request(app)
      .delete(`/api/v1/tenants/${tenant.tenantId}/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(false);
  });
});
