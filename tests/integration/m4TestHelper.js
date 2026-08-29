const express = require('express');
const connectDB = require('../../src/config/database');
const authRoutes = require('../../src/routes/auth');
const tenantRoutes = require('../../src/routes/tenants');
const onboardingRoutes = require('../../src/routes/onboarding');
const apiKeyRoutes = require('../../src/routes/apiKeys');
const dashboardRoutes = require('../../src/routes/dashboard');
const miracoreRoutes = require('../../src/routes/miracore');
const { correlationMiddleware } = require('../../src/middleware/correlationMiddleware');
const { attachTenantToRequest } = require('../../src/middleware/tenantMiddleware');
const { auditMiddleware } = require('../../src/middleware/authMiddleware');

function ensureMongoConnection() {
  process.env.ALLOW_MONGO_FALLBACK = process.env.ALLOW_MONGO_FALLBACK || 'true';
  if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
  }

  connectDB().catch((error) => {
    console.error('Mongo connection init failed in test harness:', error.message);
  });
}

function buildM4TestApp() {
  ensureMongoConnection();

  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use(attachTenantToRequest);
  app.use(auditMiddleware);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/tenants', tenantRoutes);
  app.use('/api/v1/onboarding', onboardingRoutes);
  app.use('/api/v1/tenants/:tenantId/api-keys', apiKeyRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/miracore', miracoreRoutes);
  return app;
}

function buildM5TestApp() {
  return buildM4TestApp();
}

async function loginSuperAdmin(app, username = 'superadmin', password = 'TestPassword123!') {
  const response = await require('supertest')(app)
    .post('/api/v1/auth/login')
    .send({ username, password });
  return response.body.data?.token;
}

module.exports = { buildM4TestApp, buildM5TestApp, loginSuperAdmin };
