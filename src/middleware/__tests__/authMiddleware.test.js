const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Tenant = require('../../models/Tenant');
const TenantUser = require('../../models/TenantUser');
const ApiKey = require('../../models/ApiKey');
const JWTUtils = require('../../utils/jwtUtils');
const {
  authMiddleware,
  roleMiddleware,
  permissionMiddleware,
  buildAuthContext
} = require('../authMiddleware');

describe('authMiddleware', () => {
  let user;
  let tenant;
  let membership;

  beforeEach(async () => {
    await User.deleteMany({});
    await Tenant.deleteMany({});
    await TenantUser.deleteMany({});
    await ApiKey.deleteMany({});

    tenant = await Tenant.create({
      tenantId: 'tenant-a',
      tenantName: 'Tenant A',
      fspCode: 'FL8090',
      fspName: 'ZE DONE',
      contactPerson: 'Admin',
      contactEmail: 'admin@tenant-a.com',
      contactPhone: '+255700000001',
      status: 'active'
    });

    user = await User.create({
      username: `user-${Date.now()}`,
      email: `user-${Date.now()}@test.com`,
      password: 'Password123!',
      fullName: 'Test User',
      role: 'user',
      isActive: true
    });

    membership = await TenantUser.create({
      tenantId: tenant.tenantId,
      tenant: tenant._id,
      userId: user._id,
      role: 'tenant_admin',
      isActive: true
    });
  });

  function mockReqRes(headers = {}, extras = {}) {
    const req = {
      header: (name) => headers[name] || headers[name.toLowerCase()],
      get: () => 'jest-test-agent',
      ip: '127.0.0.1',
      path: '/test',
      method: 'GET',
      correlationId: 'corr-test',
      ...extras
    };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      }
    };
    return { req, res };
  }

  it('buildAuthContext includes tenant permissions from membership', () => {
    const ctx = buildAuthContext({ user, membership });
    expect(ctx.permissions).toContain('tenant:update');
    expect(ctx.role).toBe('tenant_admin');
  });

  it('rejects requests without token', async () => {
    const { req, res } = mockReqRes();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid JWT and sets authContext', async () => {
    const token = JWTUtils.generateAccessToken(user, {
      tenantId: tenant.tenantId,
      tenantRole: membership.role,
      permissions: membership.getEffectivePermissions()
    });
    const { req, res } = mockReqRes({ Authorization: `Bearer ${token}` });
    req.tenant = { tenantId: tenant.tenantId };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user._id.toString()).toBe(user._id.toString());
    expect(req.authContext.role).toBe('tenant_admin');
  });

  it('roleMiddleware allows tenant_admin when listed', () => {
    const { req, res } = mockReqRes();
    req.user = user;
    req.authContext = buildAuthContext({ user, membership });
    const next = jest.fn();
    roleMiddleware(['tenant_admin'])(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('roleMiddleware blocks unrelated tenant role', () => {
    const { req, res } = mockReqRes();
    req.user = user;
    req.authContext = buildAuthContext({
      user,
      membership: { role: 'support_staff', getEffectivePermissions: () => ['loans:read'] }
    });
    const next = jest.fn();
    roleMiddleware(['tenant_admin'])(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('permissionMiddleware enforces required permissions', () => {
    const { req, res } = mockReqRes();
    req.authContext = buildAuthContext({ user, membership });
    const next = jest.fn();
    permissionMiddleware('audit:read')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('permissionMiddleware rejects missing permission', () => {
    const { req, res } = mockReqRes();
    req.authContext = buildAuthContext({
      user,
      membership: { role: 'support_staff', getEffectivePermissions: () => ['loans:read'] }
    });
    const next = jest.fn();
    permissionMiddleware('users:manage')(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});
