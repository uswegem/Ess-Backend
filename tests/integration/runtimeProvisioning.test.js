const request = require('supertest');
const express = require('express');
const runtimeRoutes = require('../../src/routes/runtimeProvisioning');
const RuntimeTenant = require('../../src/models/RuntimeTenant');

describe('Runtime host provisioning endpoints', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/runtime', runtimeRoutes);
  });

  it('provisions a tenant on the runtime host', async () => {
    const res = await request(app)
      .post('/api/v1/runtime/tenants/provision')
      .send({
        tenantId: 'mira-demo',
        tenantName: 'Mira Demo',
        databaseName: 'mira_demo_db',
        schemaName: 'mira_demo',
        appConfig: {
          defaultCurrency: 'TZS',
          emailProvider: 'sendgrid',
          smsProvider: 'africastalking',
          otpProvider: 'totp',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenantId).toBe('mira-demo');
    expect(res.body.data.provisioned).toBe(true);
  });

  it('bootstraps the runtime database, schema, and admin user', async () => {
    const res = await request(app)
      .post('/api/v1/runtime/tenants/bootstrap')
      .send({
        tenantId: 'mira-demo',
        tenantName: 'Mira Demo',
        databaseName: 'mira_demo_db',
        schemaName: 'mira_demo',
        adminUsername: 'mira-demo-admin',
        adminEmail: 'admin@mira-demo.local',
        adminPassword: 'AdminPass123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.databaseCreated).toBe(true);
    expect(res.body.data.schemaApplied).toBe(true);
    expect(res.body.data.adminUserCreated).toBe(true);
  });

  it('activates the runtime tenant', async () => {
    const res = await request(app)
      .post('/api/v1/runtime/tenants/activate')
      .send({
        tenantId: 'mira-demo',
        runtimeHost: '102.204.1.22',
        runtimePort: 3002,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activated).toBe(true);
    expect(res.body.data.status).toBe('active');
  });

  it('persists bootstrap metadata and admin user in Mongo', async () => {
    const res = await request(app)
      .post('/api/v1/runtime/tenants/bootstrap')
      .send({
        tenantId: 'mira-persisted',
        tenantName: 'Mira Persisted',
        databaseName: 'mira_persisted_db',
        schemaName: 'mira_persisted_schema',
        adminUsername: 'mira-admin',
        adminEmail: 'admin@mira-persisted.local',
        adminPassword: 'AdminPass123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const persisted = await RuntimeTenant.findOne({ tenantId: 'mira-persisted' });
    expect(persisted).not.toBeNull();
    expect(persisted.databaseName).toBe('mira_persisted_db');
    expect(persisted.schemaName).toBe('mira_persisted_schema');
    expect(persisted.bootstrapStatus).toBe('complete');
    expect(persisted.adminUser.username).toBe('mira-admin');
    expect(persisted.adminUser.email).toBe('admin@mira-persisted.local');
    expect(persisted.adminUser.passwordHash).toBeTruthy();
  });
});
