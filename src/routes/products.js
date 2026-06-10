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
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { sendCallback } = require('../utils/callbackUtils');
const { getMessageId } = require('../utils/messageIdGenerator');

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

/**
 * Parse CSV buffer to array of terms conditions
 */
const parseCSVBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString());
    
    stream
      .pipe(csv({
        headers: ['termsConditionNumber', 'description', 'effectiveDate'],
        skipLines: 1 // Skip header row
      }))
      .on('data', (data) => {
        if (data.termsConditionNumber && data.description) {
          results.push({
            termsConditionNumber: data.termsConditionNumber.trim(),
            description: data.description.trim(),
            effectiveDate: data.effectiveDate ? new Date(data.effectiveDate.trim()) : new Date()
          });
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

/**
 * GET /api/v1/products
 * List all products
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { active, limit = 100, offset = 0 } = req.query;
    
    const query = {};
    if (active !== undefined) {
      query.isActive = active === 'true';
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
    const product = await Product.findById(req.params.id).lean();
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, data: { product } });
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/products
 * Create a new product
 */
router.post('/', authMiddleware, roleMiddleware(['super_admin', 'admin']), async (req, res) => {
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
      mifosProductId
    } = req.body;
    
    // Check if product code already exists
    const existing = await Product.findOne({ productCode });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: `Product with code ${productCode} already exists` 
      });
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
      createdBy: req.user?.userId,
      fspCode: process.env.FSP_CODE || 'FL8090'
    });
    
    await product.save();
    
    logger.info(`Product created: ${productCode} by ${req.user?.username}`);
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/v1/products/:id
 * Update a product
 */
router.put('/:id', authMiddleware, roleMiddleware(['super_admin', 'admin']), async (req, res) => {
  try {
    const updates = req.body;
    updates.updatedBy = req.user?.userId;
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    logger.info(`Product updated: ${product.productCode} by ${req.user?.username}`);
    
    res.json({
      success: true,
      message: 'Product updated successfully',
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
router.delete('/:id', authMiddleware, roleMiddleware(['super_admin', 'admin']), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
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
 * POST /api/v1/products/:id/terms-csv
 * Upload CSV file to update terms and conditions for a product
 * 
 * CSV Format:
 * termsConditionNumber,description,effectiveDate
 * TC001,Payment must be made in full,2024-02-22
 * TC002,Loan must be paid within time,2024-02-22
 */
router.post('/:id/terms-csv', authMiddleware, roleMiddleware(['super_admin', 'admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    }
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Parse CSV
    const termsConditions = await parseCSVBuffer(req.file.buffer);
    
    if (termsConditions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid terms found in CSV. Ensure format: termsConditionNumber,description,effectiveDate' 
      });
    }
    
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
  const csvTemplate = `termsConditionNumber,description,effectiveDate
TC001,Payment must be made in full,${new Date().toISOString().split('T')[0]}
TC002,Loan must be repaid within the agreed tenure,${new Date().toISOString().split('T')[0]}
TC003,Early repayment is allowed without penalty,${new Date().toISOString().split('T')[0]}`;
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="terms_conditions_template.csv"');
  res.send(csvTemplate);
});

/**
 * POST /api/v1/products/sync-to-utumishi
 * Send PRODUCT_DETAIL message to Utumishi with all active products
 */
router.post('/sync-to-utumishi', authMiddleware, roleMiddleware(['super_admin', 'admin']), async (req, res) => {
  try {
    const products = await Product.find({ isActive: true });
    
    if (products.length === 0) {
      return res.status(400).json({ success: false, message: 'No active products to sync' });
    }
    
    // Build PRODUCT_DETAIL XML
    const messageDetailsXML = products.map(p => p.toProductDetailXML()).join('');
    
    const callbackData = {
      Data: {
        Header: {
          Sender: process.env.FSP_NAME || 'ZE DONE',
          Receiver: 'ESS_UTUMISHI',
          FSPCode: process.env.FSP_CODE || 'FL8090',
          MsgId: getMessageId('PRODUCT_DETAIL'),
          MessageType: 'PRODUCT_DETAIL'
        },
        MessageDetails: messageDetailsXML // Will be embedded as raw XML
      }
    };
    
    // For now, just return the preview - actual sending would use sendCallback
    // await sendCallback(callbackData);
    
    // Update sync timestamp
    await Product.updateMany(
      { isActive: true },
      { $set: { lastSyncedToUtumishi: new Date() } }
    );
    
    logger.info(`Product sync to Utumishi initiated by ${req.user?.username} - ${products.length} products`);
    
    res.json({
      success: true,
      message: `${products.length} products prepared for sync to Utumishi`,
      data: {
        productCount: products.length,
        products: products.map(p => ({ productCode: p.productCode, productName: p.productName }))
      }
    });
  } catch (error) {
    logger.error('Error syncing products to Utumishi:', error);
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
router.post('/import-csv', authMiddleware, roleMiddleware(['super_admin', 'admin']), upload.single('file'), async (req, res) => {
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
              fspCode: process.env.FSP_CODE || 'FL8090'
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
        const existing = await Product.findOne({ productCode: productData.productCode });
        if (existing) {
          await Product.updateOne(
            { productCode: productData.productCode },
            { $set: { ...productData, updatedBy: req.user?.userId } }
          );
          results.updated++;
        } else {
          await Product.create(productData);
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
