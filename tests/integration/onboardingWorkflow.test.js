const request = require('supertest');
const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const { buildM4TestApp, loginSuperAdmin } = require('./m4TestHelper');

describe('Onboarding workflow integration', () => {
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

  it('creates draft and validates fsp code', async () => {
    const draft = await request(app)
      .post('/api/v1/onboarding/drafts')
      .send({
        tenantName: 'Draft FSP',
        fspCode: 'DRAFT01',
        contactEmail: 'draft@fsp.com'
      });

    expect(draft.status).toBe(201);
    expect(draft.body.data.tenant.status).toBe('draft');

    const check = await request(app)
      .post('/api/v1/onboarding/validate-fsp-code')
      .send({ fspCode: 'DRAFT01' });

    expect(check.body.data.available).toBe(false);

    const check2 = await request(app)
      .post('/api/v1/onboarding/validate-fsp-code')
      .send({ fspCode: 'FREE01' });

    expect(check2.body.data.available).toBe(true);
  });

  it('runs full onboarding workflow', async () => {
    const draft = await request(app)
      .post('/api/v1/onboarding/drafts')
      .send({
        tenantName: 'Flow FSP',
        fspCode: 'FLOW01',
        contactEmail: 'flow@fsp.com'
      });

    const tenantId = draft.body.data.tenant.tenantId;

    await request(app)
      .put(`/api/v1/onboarding/drafts/${tenantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        companyInfo: {
          tenantName: 'Flow FSP',
          fspCode: 'FLOW01',
          fspName: 'Flow FSP Ltd',
          contactPerson: 'Flow Admin',
          contactEmail: 'flow@fsp.com',
          contactPhone: '+255700000055'
        },
        mifosConfig: { mode: 'inherit_default' },
        completedSteps: ['company', 'mifos']
      });

    const submit = await request(app)
      .post(`/api/v1/onboarding/${tenantId}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(submit.status).toBe(200);
    expect(submit.body.data.tenant.status).toBe('submitted');

    const review = await request(app)
      .post(`/api/v1/onboarding/${tenantId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ decision: 'approve' });

    expect(review.status).toBe(200);
    expect(review.body.data.tenant.status).toBe('approved');

    const activate = await request(app)
      .patch(`/api/v1/tenants/${tenantId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(activate.status).toBe(200);
    expect(activate.body.data.tenant.status).toBe('active');
  });

  it('rejects invalid status transition', async () => {
    const tenant = await Tenant.create({
      tenantId: 'reject-tenant',
      tenantName: 'Reject',
      fspCode: 'REJ01',
      fspName: 'Reject FSP',
      contactPerson: 'A',
      contactEmail: 'a@rej.com',
      contactPhone: '+255700000001',
      status: 'draft'
    });

    const res = await request(app)
      .patch(`/api/v1/tenants/${tenant.tenantId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(res.status).toBe(400);
  });
});
