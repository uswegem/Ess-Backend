const Tenant = require('../Tenant');
const TenantUser = require('../TenantUser');
const User = require('../User');

describe('TenantUser model', () => {
  let tenant;
  let user;

  beforeEach(async () => {
    tenant = await Tenant.create({
      tenantId: 'test-tenant',
      tenantName: 'Test',
      fspCode: 'TST01',
      fspName: 'Test FSP',
      contactPerson: 'Admin',
      contactEmail: 'admin@test.com',
      contactPhone: '+255700000000',
      status: 'active'
    });

    user = await User.create({
      username: `tenantuser-${Date.now()}`,
      email: `tenantuser-${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'admin',
      fullName: 'Tenant User'
    });
  });

  afterEach(async () => {
    await TenantUser.deleteMany({});
    await Tenant.deleteMany({});
    await User.deleteMany({});
  });

  it('creates membership with role permissions', async () => {
    const membership = await TenantUser.create({
      tenantId: tenant.tenantId,
      tenant: tenant._id,
      userId: user._id,
      role: 'tenant_admin',
      isActive: true
    });

    expect(membership.hasPermission('tenant:read')).toBe(true);
    expect(membership.hasPermission('loans:operate')).toBe(false);
    expect(membership.getEffectivePermissions()).toContain('users:manage');
  });

  it('enforces unique user per tenant', async () => {
    await TenantUser.create({
      tenantId: tenant.tenantId,
      tenant: tenant._id,
      userId: user._id,
      role: 'tenant_admin'
    });

    await expect(TenantUser.create({
      tenantId: tenant.tenantId,
      tenant: tenant._id,
      userId: user._id,
      role: 'support_staff'
    })).rejects.toThrow();
  });
});
