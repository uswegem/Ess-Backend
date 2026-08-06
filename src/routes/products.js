/**
 * Product Routes - CRUD operations for loan products
 * Includes CSV upload for terms and conditions
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const Product = require('../models/Product');
const { authMiddleware, roleMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');
const { buildTenantQuery, buildTenantListQuery } = require('../utils/tenantQuery');
const logger = require('../utils/logger');
const { sendCallback } = require('../utils/callbackUtils');
const { getMessageId } = require('../utils/messageIdGenerator');
const { sendOutgoingMessage } = require('../services/outgoingMessageService');
const { validateOutgoingMessageDetails } = require('../validations/outgoingMessageValidator');

// Configure multer for CSV file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Header names match the frontend bulk-import UI (TermsBulkImport.jsx) exactly, so a file
// built for one works identically for the other. Matched with whitespace/punctuation
// stripped and case-insensitive, so "Terms Condition Number", "terms_condition_number",
// and the legacy pre-harmonization "termsConditionNumber" all resolve the same way.
const TERMS_HEADER_ALIASES = {
  termsconditionnumber: 'termsConditionNumber',
  description: 'description',
  tceffectivedate: 'effectiveDate',
  effectivedate: 'effectiveDate',
};
const TERMS_CANONICAL_LABELS = {
  termsConditionNumber: 'Terms Condition Number',
  description: 'Description',
  effectiveDate: 'TC Effective Date',
};
const TERM_NUMBER_MAX = 20;
const DESCRIPTION_MAX = 255;
const TERMS_DATE_FORMATS = [
  /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
];

function normalizeTermsHeader(h) {
  return String(h || '')
    .replace(/^﻿/, '') // strip BOM Excel sometimes prepends to the first cell
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function parseTermsDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  // Accept YYYY-MM-DD directly; otherwise fall back to Date parsing and re-format.
  if (TERMS_DATE_FORMATS.some((re) => re.test(str))) {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a CSV buffer into { valid, invalid } terms conditions, applying the same
 * validation rules (required fields, length limits, date parseability) as the
 * frontend's bulk-import dialog. Nothing is silently dropped or defaulted.
 */
const parseCSVBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const rawRows = [];
    const stream = Readable.from(buffer.toString());

    stream
      .pipe(csv())
      .on('data', (data) => rawRows.push(data))
      .on('end', () => {
        if (rawRows.length === 0) {
          return resolve({ valid: [], invalid: [], fatalError: 'The file has no data rows.' });
        }

        const headers = Object.keys(rawRows[0]);
        const headerMap = {};
        headers.forEach((h) => {
          const key = TERMS_HEADER_ALIASES[normalizeTermsHeader(h)];
          if (key) headerMap[key] = h;
        });

        const missing = ['termsConditionNumber', 'description', 'effectiveDate'].filter((k) => !headerMap[k]);
        if (missing.length > 0) {
          const missingLabels = missing.map((k) => TERMS_CANONICAL_LABELS[k]);
          return resolve({ valid: [], invalid: [], fatalError: `Missing required column(s): ${missingLabels.join(', ')}` });
        }

        const valid = [];
        const invalid = [];
        const seen = new Map();

        rawRows.forEach((row, i) => {
          const rowNum = i + 2;
          const termsConditionNumber = String(row[headerMap.termsConditionNumber] ?? '').trim();
          const description = String(row[headerMap.description] ?? '').trim();
          const rawDate = row[headerMap.effectiveDate];
          const effectiveDate = parseTermsDate(rawDate);

          const errors = [];
          if (!termsConditionNumber) errors.push('Terms Condition Number is required');
          else if (termsConditionNumber.length > TERM_NUMBER_MAX) errors.push(`Terms Condition Number exceeds ${TERM_NUMBER_MAX} characters`);
          if (!description) errors.push('Description is required');
          else if (description.length > DESCRIPTION_MAX) errors.push(`Description exceeds ${DESCRIPTION_MAX} characters`);
          if (!rawDate) errors.push('TC Effective Date is required');
          else if (!effectiveDate) errors.push(`TC Effective Date "${rawDate}" could not be parsed`);

          if (errors.length > 0) {
            invalid.push({ rowNum, termsConditionNumber, errors });
            return;
          }

          if (seen.has(termsConditionNumber)) {
            invalid.push({ rowNum, termsConditionNumber, errors: [`Duplicate Terms Condition Number (also on row ${seen.get(termsConditionNumber)})`] });
            return;
          }
          seen.set(termsConditionNumber, rowNum);

          valid.push({ termsConditionNumber, description, effectiveDate });
        });

        resolve({ valid, invalid, fatalError: null });
      })
      .on('error', reject);
  });
};

function scopedListQuery(req, baseQuery = {}) {
  return req.tenant?.tenantId
    ? buildTenantListQuery(req.tenant.tenantId, baseQuery)
    : baseQuery;
}

function scopedItemQuery(req, id) {
  const base = { _id: id };
  return req.tenant?.tenantId
    ? buildTenantQuery(req.tenant.tenantId, base)
    : base;
}

const productWriteGuards = [
  authMiddleware,
  roleMiddleware(['super_admin', 'admin', 'tenant_admin']),
  permissionMiddleware('tenant:update')
];

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: List loan products
 *     description: Tenant-scoped product list (M3). Super-admin without tenant sees all products.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Paginated products
 *   post:
 *     summary: Create loan product
 *     description: Requires tenant:update permission. New products tagged with active tenantId.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productCode, productName, minTenure, maxTenure, interestRate, minAmount, maxAmount]
 *             properties:
 *               productCode: { type: string }
 *               deductionCode: { type: string }
 *               productName: { type: string }
 *               productDescription: { type: string }
 *               minTenure: { type: integer }
 *               maxTenure: { type: integer }
 *               interestRate: { type: number }
 *               processingFee: { type: number }
 *               insurance: { type: number }
 *               minAmount: { type: number }
 *               maxAmount: { type: number }
 *               repaymentType: { type: string }
 *               currency: { type: string, default: TZS }
 *               termsConditions: { type: array, items: { type: object } }
 *               mifosProductId: { type: string }
 *     responses:
 *       201:
 *         description: Product created
 */
/**
 * @swagger
 * /api/v1/products/import-csv:
 *   post:
 *     summary: Import products from CSV
 *     description: Bulk import; new products tagged with tenantId (M3).
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Import result
 */
/**
 * @swagger
 * /api/v1/products/{id}/submit:
 *   post:
 *     summary: Submit a product's PRODUCT_DETAIL to Utumishi
 *     description: >
 *       Sends the product's current saved data to Utumishi as a signed PRODUCT_DETAIL
 *       message, triggered explicitly from the Review modal's Submit/Retry Submit action.
 *       Saving or editing a product never triggers this on its own.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product submitted; utumishiSyncStatus set to SUBMITTED
 *       400:
 *         description: Product data fails PRODUCT_DETAIL required-field validation
 *       404:
 *         description: Product not found
 *       502:
 *         description: Send to Utumishi failed; utumishiSyncStatus set to SYNC_FAILED
 */
/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     description: Returns 404 if product belongs to another tenant.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Not found
 *   put:
 *     summary: Update product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Product updated
 *   delete:
 *     summary: Delete product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product deleted
 */
/**
 * @swagger
 * /api/v1/products/{id}/terms-csv:
 *   post:
 *     summary: Upload terms and conditions CSV
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Terms uploaded
 */
/**
 * @swagger
 * /api/v1/products/{id}/terms-csv/template:
 *   get:
 *     summary: Download terms CSV template
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV template file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */

/**
 * GET /api/v1/products
 * List all products
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { active, status, limit = 100, offset = 0 } = req.query;

    const query = scopedListQuery(req, {});
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    if (status) {
      query.status = status;
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();
    
    const total = await Product.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        products,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/v1/products/:id
 * Get single product by ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findOne(scopedItemQuery(req, req.params.id)).lean();
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, data: { product } });
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fields required for a product to be considered 'active' (a real, usable product) rather
// than a 'draft'. Checked explicitly here instead of via Mongoose `required` so a draft can
// be saved with any subset of these missing.
const REQUIRED_ACTIVE_FIELDS = [
  ['productCode', 'Product Code'],
  ['deductionCode', 'Deduction Code'],
  ['productName', 'Product Name'],
  ['minTenure', 'Min Tenure'],
  ['maxTenure', 'Max Tenure'],
  ['interestRate', 'Interest Rate'],
  ['minAmount', 'Min Amount'],
  ['maxAmount', 'Max Amount'],
];

function findMissingActiveFields(productData) {
  const missing = REQUIRED_ACTIVE_FIELDS
    .filter(([field]) => productData[field] === undefined || productData[field] === null || productData[field] === '')
    .map(([, label]) => label);

  if (!productData.termsConditions || productData.termsConditions.length === 0) {
    missing.push('At least one Terms & Conditions entry');
  } else {
    productData.termsConditions.forEach((t, i) => {
      if (!t.termsConditionNumber || !t.description || !t.effectiveDate) {
        missing.push(`Terms & Conditions entry ${i + 1} is incomplete`);
      }
    });
  }
  return missing;
}

/**
 * POST /api/v1/products
 * Create a new product (or a draft - pass status: 'draft' to skip completeness checks)
 */
router.post('/', ...productWriteGuards, async (req, res) => {
  try {
    const {
      productCode,
      deductionCode,
      productName,
      productDescription,
      minTenure,
      maxTenure,
      interestRate,
      processingFee,
      insurance,
      minAmount,
      maxAmount,
      repaymentType,
      insuranceType,
      currency,
      forExecutive,
      shariaFacility,
      termsConditions,
      mifosProductId,
      status
    } = req.body;

    const resolvedStatus = status === 'draft' ? 'draft' : 'active';

    if (resolvedStatus === 'active') {
      const missing = findMissingActiveFields({ productCode, deductionCode, productName, minTenure, maxTenure, interestRate, minAmount, maxAmount, termsConditions });
      if (missing.length > 0) {
        return res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
      }
    }

    // Check if product code already exists (only meaningful once a code has been entered)
    if (productCode) {
      const existingQuery = req.tenant?.tenantId
        ? buildTenantQuery(req.tenant.tenantId, { productCode })
        : { productCode };
      const existing = await Product.findOne(existingQuery);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Product with code ${productCode} already exists`
        });
      }
    }

    const product = new Product({
      productCode,
      deductionCode,
      productName,
      productDescription,
      minTenure,
      maxTenure,
      interestRate,
      processingFee: processingFee || 0,
      insurance: insurance || 0,
      minAmount,
      maxAmount,
      repaymentType: repaymentType || 'Flat',
      insuranceType: insuranceType || 'DISTRIBUTED',
      currency: currency || 'TZS',
      forExecutive: forExecutive || false,
      shariaFacility: shariaFacility || false,
      termsConditions: termsConditions || [],
      mifosProductId,
      status: resolvedStatus,
      createdBy: req.user?.userId,
      fspCode: req.tenant?.fspCode || process.env.FSP_CODE || 'FL8090',
      ...(req.tenant?.tenantId && {
        tenantId: req.tenant.tenantId,
        tenant: req.tenant.tenantObjectId
      })
    });

    await product.save();

    logger.info(`Product ${resolvedStatus === 'draft' ? 'draft saved' : 'created'}: ${productCode || product._id} by ${req.user?.username}`);

    res.status(201).json({
      success: true,
      message: resolvedStatus === 'draft' ? 'Draft saved' : 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/v1/products/:id
 * Update a product (or a draft - pass status: 'draft' to skip completeness checks,
 * status: 'active' to finalize a draft into a real product)
 */
router.put('/:id', ...productWriteGuards, async (req, res) => {
  try {
    const updates = req.body;
    updates.updatedBy = req.user?.userId;

    const existing = await Product.findOne(scopedItemQuery(req, req.params.id)).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const merged = { ...existing, ...updates };
    const resolvedStatus = merged.status === 'draft' ? 'draft' : 'active';
    updates.status = resolvedStatus;

    if (resolvedStatus === 'active') {
      const missing = findMissingActiveFields(merged);
      if (missing.length > 0) {
        return res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
      }
    }

    const product = await Product.findOneAndUpdate(
      scopedItemQuery(req, req.params.id),
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    logger.info(`Product ${resolvedStatus === 'draft' ? 'draft saved' : 'updated'}: ${product.productCode || product._id} by ${req.user?.username}`);

    res.json({
      success: true,
      message: resolvedStatus === 'draft' ? 'Draft saved' : 'Product updated successfully',
      data: { product }
    });
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/v1/products/:id
 * Delete a product (soft delete - sets isActive to false)
 */
router.delete('/:id', ...productWriteGuards, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      scopedItemQuery(req, req.params.id),
      { $set: { isActive: false, updatedBy: req.user?.userId } },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    logger.info(`Product deactivated: ${product.productCode} by ${req.user?.username}`);
    
    res.json({
      success: true,
      message: 'Product deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/products/decommission
 * Bulk-deactivate products and notify Utumishi via PRODUCT_DECOMMISSION for each.
 */
router.post('/decommission', ...productWriteGuards, async (req, res) => {
  try {
    const { productCodes } = req.body;
    if (!Array.isArray(productCodes) || productCodes.length === 0) {
      return res.status(400).json({ success: false, message: 'productCodes must be a non-empty array' });
    }

    const products = await Product.find(scopedListQuery(req, { productCode: { $in: productCodes }, isActive: true }));
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching active products found' });
    }

    await Product.updateMany(
      scopedListQuery(req, { _id: { $in: products.map((p) => p._id) } }),
      { $set: { isActive: false, updatedBy: req.user?.userId } }
    );

    const essResponses = [];
    for (const product of products) {
      const callbackData = {
        Data: {
          Header: {
            Sender: req.tenant.fspName || process.env.FSP_NAME || 'ZE DONE',
            Receiver: 'ESS_UTUMISHI',
            FSPCode: req.tenant.fspCode || process.env.FSP_CODE || 'FL8090',
            MsgId: getMessageId('PRODUCT_DECOMMISSION'),
            MessageType: 'PRODUCT_DECOMMISSION'
          },
          MessageDetails: `<ProductCode>${product.productCode}</ProductCode>`
        }
      };
      try {
        const essResponse = await sendCallback(callbackData);
        essResponses.push({ productCode: product.productCode, success: true, response: essResponse.data });
      } catch (essError) {
        logger.error(`Failed to send PRODUCT_DECOMMISSION for ${product.productCode}:`, essError.message);
        essResponses.push({ productCode: product.productCode, success: false, error: essError.message });
      }
    }

    logger.info(`Decommissioned ${products.length} products by ${req.user?.username}`);

    res.json({
      success: true,
      message: `${products.length} product(s) decommissioned`,
      data: {
        decommissioned: products.map((p) => p.productCode),
        essResponses
      }
    });
  } catch (error) {
    logger.error('Error decommissioning products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/products/:id/terms-csv
 * Upload CSV file to update terms and conditions for a product.
 * Headers match the frontend bulk-import dialog exactly (case-insensitive, any order):
 * Terms Condition Number, Description, TC Effective Date
 * All-or-nothing: if any row fails validation, nothing is saved - the response lists
 * every failing row so the caller can fix and re-upload, matching the frontend's
 * pre-commit summary behavior for the same reasons (no interactive confirm step here).
 */
router.post('/:id/terms-csv', ...productWriteGuards, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    }

    const product = await Product.findOne(scopedItemQuery(req, req.params.id));
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const { valid, invalid, fatalError } = await parseCSVBuffer(req.file.buffer);

    if (fatalError) {
      return res.status(400).json({ success: false, message: fatalError });
    }
    if (invalid.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${invalid.length} of ${valid.length + invalid.length} row(s) failed validation. No changes were saved.`,
        data: { invalid, validCount: valid.length }
      });
    }
    if (valid.length === 0) {
      return res.status(400).json({ success: false, message: 'The file has no data rows.' });
    }

    const termsConditions = valid;

    // Update product with new terms
    const appendMode = req.query.append === 'true';

    if (appendMode) {
      product.termsConditions.push(...termsConditions);
    } else {
      product.termsConditions = termsConditions;
    }

    product.updatedBy = req.user?.userId;
    await product.save();

    logger.info(`Product ${product.productCode} terms updated from CSV (${termsConditions.length} terms) by ${req.user?.username}`);

    res.json({
      success: true,
      message: `Successfully ${appendMode ? 'added' : 'replaced'} ${termsConditions.length} terms and conditions`,
      data: {
        product,
        termsCount: product.termsConditions.length
      }
    });
  } catch (error) {
    logger.error('Error uploading terms CSV:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/v1/products/:id/terms-csv/template
 * Download CSV template for terms and conditions
 */
router.get('/:id/terms-csv/template', authMiddleware, (req, res) => {
  const csvTemplate = `Terms Condition Number,Description,TC Effective Date
TC001,Payment must be made in full,${new Date().toISOString().split('T')[0]}
TC002,Loan must be repaid within the agreed tenure,${new Date().toISOString().split('T')[0]}
TC003,Early repayment is allowed without penalty,${new Date().toISOString().split('T')[0]}`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="terms_conditions_template.csv"');
  res.send(csvTemplate);
});

/**
 * POST /api/v1/products/:id/submit
 * Explicit, single-product action triggered from the Review modal's "Submit" (or
 * "Retry Submit") button. Sends PRODUCT_DETAIL for this product's *current saved data*
 * to Utumishi via the shared signing/logging core, then reflects the outcome on the
 * product itself so the operator can see it needs no further action, or needs a retry.
 *
 * Saving/editing a product (POST/PUT above) never hits this route - only this explicit
 * action notifies Utumishi, by design.
 */
router.post('/:id/submit', authMiddleware, roleMiddleware(['super_admin', 'admin', 'tenant_admin']), permissionMiddleware('products:submit'), async (req, res) => {
  try {
    const product = await Product.findOne(scopedItemQuery(req, req.params.id));
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Validate against the same required-field list the shared send core will enforce
    // (values converted to strings, since that's the shape a real XML-parsed
    // MessageDetails would have - Joi's string schema doesn't coerce booleans/numbers).
    const validation = validateOutgoingMessageDetails('PRODUCT_DETAIL', {
      DeductionCode: String(product.deductionCode ?? ''),
      ProductCode: String(product.productCode ?? ''),
      ProductName: String(product.productName ?? ''),
      ProductDescription: String(product.productDescription ?? ''),
      ForExecutive: String(product.forExecutive),
      MinimumTenure: String(product.minTenure ?? ''),
      MaximumTenure: String(product.maxTenure ?? ''),
      InterestRate: String(product.interestRate ?? ''),
      ProcessFee: String(product.processingFee ?? ''),
      Insurance: String(product.insurance ?? ''),
      MaxAmount: String(product.maxAmount ?? ''),
      MinAmount: String(product.minAmount ?? ''),
      RepaymentType: String(product.repaymentType ?? ''),
      Currency: String(product.currency ?? ''),
      InsuranceType: String(product.insuranceType ?? ''),
      ShariaFacility: String(product.shariaFacility)
    });
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.description });
    }

    try {
      const result = await sendOutgoingMessage({
        tenant: req.tenant,
        user: req.user,
        correlationId: req.correlationId,
        MessageType: 'PRODUCT_DETAIL',
        MessageDetails: product.toProductDetailFragment()
      });

      product.updatedBy = req.user?.userId;

      // sendOutgoingMessage resolving only means the HTTPS call completed - result.success
      // (derived from Utumishi's own ResponseCode, not just the HTTP status) is what actually
      // tells us whether Utumishi accepted the submission. A 200 with e.g. "8009 Invalid
      // Signature" in the body must not be recorded as SUBMITTED.
      if (result.success) {
        product.utumishiSyncStatus = 'SUBMITTED';
        product.lastSyncedToUtumishi = new Date();
        product.lastSubmitError = undefined;
        await product.save();

        logger.info(`Product ${product.productCode} submitted to Utumishi by ${req.user?.username}`);

        return res.json({ success: true, message: 'Product submitted to Utumishi', data: { product } });
      }

      const rejectionReason = result.statusDesc || `Rejected by Utumishi (code ${result.responseCode})`;
      product.utumishiSyncStatus = 'SYNC_FAILED';
      product.lastSubmitError = rejectionReason;
      await product.save();

      logger.error(`Product ${product.productCode} rejected by Utumishi: ${rejectionReason}`);

      return res.status(502).json({
        success: false,
        message: rejectionReason,
        data: { product }
      });
    } catch (sendError) {
      product.utumishiSyncStatus = 'SYNC_FAILED';
      product.lastSubmitError = sendError.message;
      await product.save();

      logger.error(`Failed to submit product ${product.productCode} to Utumishi:`, sendError.message);

      return res.status(sendError.statusCode || 502).json({
        success: false,
        message: sendError.message,
        data: { product }
      });
    }
  } catch (error) {
    logger.error('Error submitting product to Utumishi:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/products/import-csv
 * Bulk import products from CSV
 * 
 * CSV Format:
 * productCode,deductionCode,productName,productDescription,minTenure,maxTenure,interestRate,processingFee,insurance,minAmount,maxAmount,repaymentType,insuranceType,forExecutive,shariaFacility
 */
router.post('/import-csv', ...productWriteGuards, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    }
    
    const products = [];
    const stream = Readable.from(req.file.buffer.toString());
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          if (data.productCode && data.productName) {
            products.push({
              productCode: data.productCode.trim(),
              deductionCode: data.deductionCode?.trim() || data.productCode.trim(),
              productName: data.productName.trim(),
              productDescription: data.productDescription?.trim() || '',
              minTenure: parseInt(data.minTenure) || 1,
              maxTenure: parseInt(data.maxTenure) || 12,
              interestRate: parseFloat(data.interestRate) || 0,
              processingFee: parseFloat(data.processingFee) || 0,
              insurance: parseFloat(data.insurance) || 0,
              minAmount: parseFloat(data.minAmount) || 0,
              maxAmount: parseFloat(data.maxAmount) || 0,
              repaymentType: data.repaymentType?.trim() || 'Flat',
              insuranceType: data.insuranceType?.trim() || 'DISTRIBUTED',
              forExecutive: data.forExecutive?.toLowerCase() === 'true',
              shariaFacility: data.shariaFacility?.toLowerCase() === 'true',
              createdBy: req.user?.userId,
              fspCode: req.tenant?.fspCode || process.env.FSP_CODE || 'FL8090',
              ...(req.tenant?.tenantId && {
                tenantId: req.tenant.tenantId,
                tenant: req.tenant.tenantObjectId
              })
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    if (products.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid products found in CSV' });
    }
    
    // Upsert products
    const results = { created: 0, updated: 0, errors: [] };
    
    for (const productData of products) {
      try {
        const existingQuery = req.tenant?.tenantId
          ? buildTenantQuery(req.tenant.tenantId, { productCode: productData.productCode })
          : { productCode: productData.productCode };
        const existing = await Product.findOne(existingQuery);
        if (existing) {
          await Product.updateOne(
            existingQuery,
            { $set: { ...productData, updatedBy: req.user?.userId } }
          );
          results.updated++;
        } else {
          await Product.create({
            ...productData,
            ...(req.tenant?.tenantId && {
              tenantId: req.tenant.tenantId,
              tenant: req.tenant.tenantObjectId
            })
          });
          results.created++;
        }
      } catch (err) {
        results.errors.push({ productCode: productData.productCode, error: err.message });
      }
    }
    
    logger.info(`Product CSV import by ${req.user?.username}: ${results.created} created, ${results.updated} updated`);
    
    res.json({
      success: true,
      message: `Imported ${results.created} new products, updated ${results.updated} existing`,
      data: results
    });
  } catch (error) {
    logger.error('Error importing products CSV:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
