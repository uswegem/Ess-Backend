const express = require('express');
const authRoutes = require('../../src/routes/auth');
const tenantRoutes = require('../../src/routes/tenants');
const onboardingRoutes = require('../../src/routes/onboarding');
const apiKeyRoutes = require('../../src/routes/apiKeys');
const { correlationMiddleware } = require('../../src/middleware/correlationMiddleware');
const { attachTenantToRequest } = require('../../src/middleware/tenantMiddleware');
const { auditMiddleware } = require('../../src/middleware/authMiddleware');

function buildM4TestApp() {
  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use(attachTenantToRequest);
  app.use(auditMiddleware);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/tenants', tenantRoutes);
  app.use('/api/v1/onboarding', onboardingRoutes);
  app.use('/api/v1/tenants/:tenantId/api-keys', apiKeyRoutes);
  return app;
}

async function loginSuperAdmin(app, username = 'superadmin', password = 'TestPassword123!') {
  const response = await require('supertest')(app)
    .post('/api/v1/auth/login')
    .send({ username, password });
  return response.body.data?.token;
}

module.exports = { buildM4TestApp, loginSuperAdmin };
