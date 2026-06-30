const request = require('supertest');
const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');
const { getEffectiveConfig } = require('../../src/services/mifosTenantClient');
const mifosTenantClient = require('../../src/services/mifosTenantClient');
const { applyTenantMifosToConfig } = require('../../src/services/cbs.api');
const { runWithTenantContext } = require('../../src/utils/tenantContext');

describe('MIFOS tenant config integration', () => {
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
      tenantId: 'mifos-tenant',
      tenantName: 'MIFOS Tenant',
      fspCode: 'MIF01',
      fspName: 'MIFOS FSP',
      contactPerson: 'A',
      contactEmail: 'a@mifos.com',
      contactPhone: '+255700000001',
      status: 'draft'
    });
  });

  it('saves inherit_default mifos config', async () => {
    const res = await request(app)
      .put(`/api/v1/tenants/${tenant.tenantId}/mifos-config`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'inherit_default' });

    expect(res.status).toBe(200);
    expect(res.body.data.tenant.mifosConfigured).toBe(true);
  });

  it('validates mifos config in test mode', async () => {
    await request(app)
      .put(`/api/v1/tenants/${tenant.tenantId}/mifos-config`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'inherit_default' });

    const res = await request(app)
      .post(`/api/v1/tenants/${tenant.tenantId}/mifos-config/validate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
  });

  it('validates unsaved override mifos config from request body', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenant.tenantId}/mifos-config/validate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'override',
        baseUrl: 'https://tenant-draft.example.com/api/v1',
        tenantId: 'draft-fineract',
        makerUsername: 'maker',
        makerPassword: 'secret'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
  });

  it('rejects draft validation when submitted credentials fail authentication', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const fetchSpy = jest.spyOn(mifosTenantClient, 'fetchToken').mockRejectedValue(
      Object.assign(new Error('MIFOS authentication failed (401). Verify CBS maker/checker username and password.'), {
        response: { status: 401 }
      })
    );

    const res = await request(app)
      .post(`/api/v1/tenants/${tenant.tenantId}/mifos-config/validate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'override',
        baseUrl: 'https://tenant-draft.example.com/api/v1',
        tenantId: 'draft-fineract',
        makerUsername: 'maker',
        makerPassword: 'wrong-password'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.message).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
    fetchSpy.mockRestore();
  });

  it('returns effective platform config for inherit_default', async () => {
    const updated = await Tenant.findOne({ tenantId: tenant.tenantId });
    updated.mifosConfig = { mode: 'inherit_default' };
    const config = getEffectiveConfig(updated);
    expect(config.baseUrl).toBe(process.env.CBS_BASE_URL);
    expect(config.tenantId).toBe(process.env.CBS_Tenant);
  });

  it('returns override tenant CBS settings from effective config', () => {
    const doc = {
      tenantId: 'override-1',
      mifosConfig: {
        mode: 'override',
        baseUrl: 'https://tenant-override.example.com/api/v1',
        tenantId: 'fineract-tenant',
        makerUsername: 'maker',
        checkerUsername: 'checker'
      },
      getMakerPassword: () => 'maker-pass',
      getCheckerPassword: () => 'checker-pass'
    };
    const config = getEffectiveConfig(doc);
    expect(config.baseUrl).toBe('https://tenant-override.example.com/api');
    expect(config.tenantId).toBe('fineract-tenant');
    expect(config.mode).toBe('override');
  });

  it('applyTenantMifosToConfig resolves override baseUrl from tenant context', async () => {
    await Tenant.findOneAndUpdate(
      { tenantId: tenant.tenantId },
      {
        $set: {
          'mifosConfig.mode': 'override',
          'mifosConfig.baseUrl': 'https://ctx-override.example.com/api/v1',
          'mifosConfig.tenantId': 'ctx-fineract',
          'mifosConfig.makerUsername': 'maker',
          'mifosConfig.checkerUsername': 'checker'
        }
      }
    );

    jest.spyOn(mifosTenantClient, 'getTokenForTenant').mockResolvedValue('mock-token');
    const config = { headers: {} };

    await runWithTenantContext({ tenantId: tenant.tenantId }, async () => {
      await applyTenantMifosToConfig(config, 'maker');
    });

    expect(config.baseURL).toBe('https://ctx-override.example.com/api');
    expect(config.headers['Mifos-Platform-TenantId']).toBe('ctx-fineract');
    expect(config.headers.Authorization).toBe('Basic mock-token');
    jest.restoreAllMocks();
  });

  it('returns saved mifos config on tenant get', async () => {
    await request(app)
      .put(`/api/v1/tenants/${tenant.tenantId}/mifos-config`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'override',
        baseUrl: 'https://tenant-saved.example.com/api/v1',
        tenantId: 'saved-fineract',
        makerUsername: 'maker',
        makerPassword: 'secret'
      });

    const res = await request(app)
      .get(`/api/v1/tenants/${tenant.tenantId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tenant.mifosConfig).toMatchObject({
      mode: 'override',
      baseUrl: 'https://tenant-saved.example.com/api',
      tenantId: 'saved-fineract',
      makerUsername: 'maker',
      hasMakerPassword: true
    });
    expect(res.body.data.tenant.mifosConfig.makerPasswordEncrypted).toBeUndefined();
  });

  it('returns integration health', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenant.tenantId}/integration/health`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mifos).toBeDefined();
    expect(res.body.data.apiKeys).toBeDefined();
  });
});
