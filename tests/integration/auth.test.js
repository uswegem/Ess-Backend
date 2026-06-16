const request = require('supertest');
const express = require('express');
const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const TenantUser = require('../../src/models/TenantUser');
const RefreshToken = require('../../src/models/RefreshToken');
const authRoutes = require('../../src/routes/auth');
const { correlationMiddleware } = require('../../src/middleware/correlationMiddleware');
const { attachTenantToRequest } = require('../../src/middleware/tenantMiddleware');
const { auditMiddleware } = require('../../src/middleware/authMiddleware');

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use(attachTenantToRequest);
  app.use(auditMiddleware);
  app.use('/api/v1/auth', authRoutes);
  return app;
}

describe('Authentication API integration', () => {
  let app;
  let user;
  let tenant;

  beforeEach(async () => {
    app = buildTestApp();
    await User.deleteMany({});
    await Tenant.deleteMany({});
    await TenantUser.deleteMany({});
    await RefreshToken.deleteMany({});

    tenant = await Tenant.create({
      tenantId: 'legacy-zedone',
      tenantName: 'Legacy',
      fspCode: 'FL8090',
      fspName: 'ZE DONE',
      contactPerson: 'Admin',
      contactEmail: 'admin@test.com',
      contactPhone: '+255700000000',
      status: 'active'
    });

    user = await User.create({
      username: 'authuser',
      email: 'authuser@test.com',
      password: 'TestPassword123!',
      fullName: 'Auth User',
      role: 'super_admin',
      isActive: true
    });

    await TenantUser.create({
      tenantId: tenant.tenantId,
      tenant: tenant._id,
      userId: user._id,
      role: 'tenant_admin',
      isActive: true
    });
  });

  it('logs in and returns access + refresh tokens', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'authuser', password: 'TestPassword123!' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeTruthy();
    expect(response.body.data.refreshToken).toBeTruthy();
  });

  it('refreshes tokens with valid refresh token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'authuser', password: 'TestPassword123!' });

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.data.refreshToken });

    expect(refresh.status).toBe(200);
    expect(refresh.body.data.token).toBeTruthy();
    expect(refresh.body.data.refreshToken).toBeTruthy();
    expect(refresh.body.data.refreshToken).not.toBe(login.body.data.refreshToken);
  });

  it('rejects profile access without token', async () => {
    const response = await request(app).get('/api/v1/auth/profile');
    expect(response.status).toBe(401);
  });

  it('allows profile access with valid access token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'authuser', password: 'TestPassword123!' });

    const profile = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(profile.status).toBe(200);
    expect(profile.body.data.user.username).toBe('authuser');
  });

  it('rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'authuser', password: 'wrongpassword' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
