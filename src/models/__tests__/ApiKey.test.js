const Tenant = require('../Tenant');
const ApiKey = require('../ApiKey');

describe('ApiKey model', () => {
  let tenant;

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
  });

  afterEach(async () => {
    await ApiKey.deleteMany({});
    await Tenant.deleteMany({});
  });

  it('creates API key without storing raw key', async () => {
    const { apiKey, rawKey, rawSecret } = await ApiKey.createForTenant({
      tenant,
      name: 'Integration Key'
    });

    expect(rawKey).toMatch(/^mk_live_/);
    expect(rawSecret).toBeTruthy();
    expect(apiKey.keyHash).toBeTruthy();
    expect(apiKey.keyHash).not.toBe(rawKey);

    const found = await ApiKey.findByRawKey(rawKey);
    expect(found._id.toString()).toBe(apiKey._id.toString());
  });

  it('redacts hash in toJSON', async () => {
    const { apiKey } = await ApiKey.createForTenant({
      tenant,
      name: 'Safe Key'
    });

    const json = apiKey.toJSON();
    expect(json.keyHash).toBeUndefined();
    expect(json.secretEncrypted).toBeUndefined();
  });

  it('revokes unusable keys', async () => {
    const { apiKey } = await ApiKey.createForTenant({
      tenant,
      name: 'Revoke Key'
    });

    await apiKey.revoke(null, 'test');
    expect(apiKey.isUsable()).toBe(false);
  });

  it('rotates key and revokes previous', async () => {
    const { apiKey, rawKey } = await ApiKey.createForTenant({
      tenant,
      name: 'Rotate Key'
    });

    const result = await ApiKey.rotate(apiKey._id, { reason: 'test rotation' });
    expect(result.rawKey).toMatch(/^mk_live_/);
    expect(result.rawKey).not.toBe(rawKey);

    const old = await ApiKey.findById(apiKey._id);
    expect(old.isUsable()).toBe(false);

    const found = await ApiKey.findByRawKey(result.rawKey);
    expect(found._id.toString()).toBe(result.apiKey._id.toString());
  });
});
