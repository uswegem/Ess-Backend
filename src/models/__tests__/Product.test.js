const Product = require('../Product');

describe('Product model - conditional required-when-active fields', () => {
  afterEach(async () => {
    await Product.deleteMany({});
  });

  it('saves a draft with several required-when-active fields missing', async () => {
    const draft = await Product.create({
      productCode: 'DRAFT001',
      status: 'draft'
      // deductionCode, productName, minTenure, maxTenure, interestRate, minAmount,
      // maxAmount are all deliberately omitted here - this is the exact scenario that
      // previously failed with a ValidationError despite the schema's own comment
      // claiming drafts could be saved incomplete.
    });

    expect(draft.status).toBe('draft');
    expect(draft.productName).toBeUndefined();
    expect(draft.minTenure).toBeUndefined();
  });

  it('rejects an incomplete product when status is active (via .save())', async () => {
    const incomplete = new Product({
      productCode: 'ACTIVE001',
      status: 'active'
      // Same missing fields as above - this should now fail validation, since it's
      // no longer a draft.
    });

    await expect(incomplete.save()).rejects.toThrow();
  });

  it('creates a fully-populated active product with no validation errors', async () => {
    const product = await Product.create({
      productCode: 'ACTIVE002',
      deductionCode: 'DED002',
      productName: 'Full Product',
      minTenure: 3,
      maxTenure: 36,
      interestRate: 28,
      minAmount: 100000,
      maxAmount: 5000000,
      status: 'active'
    });

    expect(product.status).toBe('active');
  });

  it('rejects activating a still-incomplete draft via findOneAndUpdate (context: query), matching the PUT /products/:id route', async () => {
    const draft = await Product.create({
      productCode: 'DRAFT002',
      status: 'draft'
      // Still missing productName, minTenure, etc.
    });

    await expect(
      Product.findOneAndUpdate(
        { _id: draft._id },
        { $set: { status: 'active' } },
        { new: true, runValidators: true, context: 'query' }
      )
    ).rejects.toThrow();
  });

  it('allows activating a draft via findOneAndUpdate once all required-when-active fields are supplied in the same update', async () => {
    const draft = await Product.create({
      productCode: 'DRAFT003',
      status: 'draft'
    });

    const activated = await Product.findOneAndUpdate(
      { _id: draft._id },
      {
        $set: {
          status: 'active',
          deductionCode: 'DED003',
          productName: 'Now Complete',
          minTenure: 3,
          maxTenure: 36,
          interestRate: 28,
          minAmount: 100000,
          maxAmount: 5000000
        }
      },
      { new: true, runValidators: true, context: 'query' }
    );

    expect(activated.status).toBe('active');
    expect(activated.productName).toBe('Now Complete');
  });
});
