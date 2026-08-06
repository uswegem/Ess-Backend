const Product = require('../../models/Product');
const { resolveMifosProductId, DEFAULT_MIFOS_PRODUCT_ID } = require('../productResolver');

jest.mock('../../models/Product');

describe('productResolver', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns mifosProductId from MiraCore product', async () => {
    Product.findOne.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ mifosProductId: 42 }),
      }),
    });
    const id = await resolveMifosProductId('WWL', 'tenant-a');
    expect(id).toBe(42);
  });

  it('falls back to numeric productCode', async () => {
    Product.findOne.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve(null),
      }),
    });
    expect(await resolveMifosProductId('17', 'tenant-a')).toBe(17);
  });

  it('falls back to default when unresolved', async () => {
    Product.findOne.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve(null),
      }),
    });
    expect(await resolveMifosProductId('WWL', 'tenant-a')).toBe(DEFAULT_MIFOS_PRODUCT_ID);
  });
});
