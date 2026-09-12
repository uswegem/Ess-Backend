const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

// Isolate this test to the products router's own logic (loan-reference guard, audit log) -
// mock auth/role/permission middleware to a fixed authenticated user rather than pulling in
// the full JWT/tenant test-app plumbing, which isn't needed to exercise this route.
jest.mock('../../src/middleware/authMiddleware', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: new (require('mongoose')).Types.ObjectId(), username: 'tester' };
    next();
  },
  roleMiddleware: () => (req, res, next) => next(),
  permissionMiddleware: () => (req, res, next) => next()
}));

const Product = require('../../src/models/Product');
const LoanMapping = require('../../src/models/LoanMapping');
const AuditLog = require('../../src/models/AuditLog');
const productsRouter = require('../../src/routes/products');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/products', productsRouter);
  return app;
}

describe('DELETE /api/v1/products/:id', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(async () => {
    await Product.deleteMany({});
    await LoanMapping.deleteMany({});
    await AuditLog.deleteMany({});
  });

  it('deletes (soft-deletes) a product with no loan references, and writes an audit log entry', async () => {
    const product = await Product.create({
      productCode: 'DEL001',
      deductionCode: 'DED001',
      productName: 'Deletable Product',
      minTenure: 3,
      maxTenure: 36,
      interestRate: 28,
      minAmount: 100000,
      maxAmount: 5000000,
      status: 'active'
    });

    const res = await request(app).delete(`/api/v1/products/${product._id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await Product.findById(product._id).lean();
    expect(updated.isActive).toBe(false);

    const auditEntry = await AuditLog.findOne({ action: 'delete_product' }).lean();
    expect(auditEntry).toBeTruthy();
    expect(auditEntry.metadata.productCode).toBe('DEL001');
  });

  it('blocks deletion (409) when a LoanMapping references the product, and does not deactivate it', async () => {
    const product = await Product.create({
      productCode: 'DEL002',
      deductionCode: 'DED002',
      productName: 'Product With Loans',
      minTenure: 3,
      maxTenure: 36,
      interestRate: 28,
      minAmount: 100000,
      maxAmount: 5000000,
      status: 'active'
    });

    await LoanMapping.create({
      essApplicationNumber: 'ESS_TEST_001',
      productCode: 'DEL002',
      requestedAmount: 1000000,
      tenure: 24,
      status: 'DISBURSED'
    });

    const res = await request(app).delete(`/api/v1/products/${product._id}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot be deleted/i);

    const unchanged = await Product.findById(product._id).lean();
    expect(unchanged.isActive).toBe(true);

    const auditEntry = await AuditLog.findOne({ action: 'delete_product' }).lean();
    expect(auditEntry).toBeNull();
  });
});
