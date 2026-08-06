const mongoose = require('mongoose');
const Tenant = require('../Tenant');

describe('Tenant model', () => {
  afterEach(async () => {
    await Tenant.deleteMany({});
  });

  it('creates a tenant with required fields', async () => {
    const tenant = await Tenant.create({
      tenantId: 'legacy-zedone',
      tenantName: 'ZE DONE',
      fspCode: 'FL8090',
      fspName: 'ZE DONE',
      contactPerson: 'Admin',
      contactEmail: 'admin@test.com',
      contactPhone: '+255700000000',
      status: 'active'
    });

    expect(tenant.tenantId).toBe('legacy-zedone');
    expect(tenant.fspCode).toBe('FL8090');
    expect(tenant.isOperational()).toBe(true);
  });

  it('redacts secrets in toJSON', async () => {
    const tenant = await Tenant.create({
      tenantId: 'test-tenant',
      tenantName: 'Test',
      fspCode: 'TST01',
      fspName: 'Test FSP',
      contactPerson: 'Admin',
      contactEmail: 'admin@test.com',
      contactPhone: '+255700000000',
      status: 'active',
      mifosConfig: {
        makerPasswordEncrypted: 'secret123',
        checkerPasswordEncrypted: 'secret456'
      }
    });

    const json = tenant.toJSON();
    expect(json.mifosConfig.makerPasswordEncrypted).toBeUndefined();
    expect(json.mifosConfig.checkerPasswordEncrypted).toBeUndefined();
  });

  it('rejects duplicate tenantId', async () => {
    const data = {
      tenantId: 'dup-tenant',
      tenantName: 'Dup',
      fspCode: 'DUP01',
      fspName: 'Dup FSP',
      contactPerson: 'Admin',
      contactEmail: 'admin@test.com',
      contactPhone: '+255700000000'
    };

    await Tenant.create(data);
    await expect(Tenant.create({ ...data, fspCode: 'DUP02' })).rejects.toThrow();
  });
});
