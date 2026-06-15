const Tenant = require('../../src/models/Tenant');
const ApiKey = require('../../src/models/ApiKey');
const LoanMapping = require('../../src/models/LoanMapping');
const { secureFindOne, secureCreate, buildTenantQuery } = require('../../src/utils/tenantQuery');

describe('tenant isolation integration', () => {
  let tenantA;
  let tenantB;
  let keyA;
  let rawKeyA;

  beforeEach(async () => {
    await LoanMapping.deleteMany({});
    await ApiKey.deleteMany({});
    await Tenant.deleteMany({});

    tenantA = await Tenant.create({
      tenantId: 'tenant-a',
      tenantName: 'Tenant A',
      fspCode: 'AAAA1',
      fspName: 'FSP A',
      contactPerson: 'A',
      contactEmail: 'a@test.com',
      contactPhone: '+255700000001',
      status: 'active'
    });

    tenantB = await Tenant.create({
      tenantId: 'tenant-b',
      tenantName: 'Tenant B',
      fspCode: 'BBBB2',
      fspName: 'FSP B',
      contactPerson: 'B',
      contactEmail: 'b@test.com',
      contactPhone: '+255700000002',
      status: 'active'
    });

    await secureCreate(LoanMapping, 'tenant-a', {
      essApplicationNumber: 'APP-001',
      essCheckNumber: 'CHK-001',
      productCode: '17',
      requestedAmount: 1000000,
      tenure: 12,
      status: 'INITIAL_OFFER'
    }, tenantA._id);

    await secureCreate(LoanMapping, 'tenant-b', {
      essApplicationNumber: 'APP-001',
      essCheckNumber: 'CHK-001',
      productCode: '17',
      requestedAmount: 2000000,
      tenure: 24,
      status: 'INITIAL_OFFER'
    }, tenantB._id);

    const created = await ApiKey.createForTenant({ tenant: tenantA, name: 'Tenant A Key' });
    keyA = created.apiKey;
    rawKeyA = created.rawKey;
  });

  it('scopes findOne to tenant', async () => {
    const a = await secureFindOne(LoanMapping, 'tenant-a', { essApplicationNumber: 'APP-001' });
    const b = await secureFindOne(LoanMapping, 'tenant-b', { essApplicationNumber: 'APP-001' });

    expect(a.requestedAmount).toBe(1000000);
    expect(b.requestedAmount).toBe(2000000);
  });

  it('prevents cross-tenant reads with same identifier', async () => {
    const cross = await secureFindOne(LoanMapping, 'tenant-a', { essApplicationNumber: 'APP-001' });
    expect(cross.tenantId).toBe('tenant-a');
    expect(cross.requestedAmount).not.toBe(2000000);
  });

  it('writes always include tenantId', async () => {
    const created = await secureCreate(LoanMapping, 'tenant-a', {
      essApplicationNumber: 'APP-002',
      essCheckNumber: 'CHK-002',
      productCode: '17',
      requestedAmount: 500000,
      tenure: 6,
      status: 'INITIAL_OFFER'
    }, tenantA._id);

    expect(created.tenantId).toBe('tenant-a');
    expect(created.tenant.toString()).toBe(tenantA._id.toString());
  });

  it('buildTenantQuery requires tenantId', () => {
    expect(() => buildTenantQuery(null, {})).toThrow('tenantId is required');
    expect(buildTenantQuery('tenant-a', { status: 'INITIAL_OFFER' })).toEqual({
      status: 'INITIAL_OFFER',
      tenantId: 'tenant-a'
    });
  });

  it('resolves API key to correct tenant only', async () => {
    const found = await ApiKey.findByRawKey(rawKeyA);
    expect(found.tenantId).toBe('tenant-a');
    expect(found._id.toString()).toBe(keyA._id.toString());
  });
});
