const Product = require('../models/Product');
const logger = require('../utils/logger');

const DEFAULT_MIFOS_PRODUCT_ID = 17;

/**
 * Resolve Fineract loan product ID from MiraCore product code.
 * Uses mifosProductId when configured; falls back to numeric productCode or default.
 */
async function resolveMifosProductId(productCode, tenantId = null) {
  if (!productCode) {
    return DEFAULT_MIFOS_PRODUCT_ID;
  }

  const code = String(productCode).trim();
  const query = { productCode: code, isActive: true };
  if (tenantId) {
    query.tenantId = tenantId;
  }

  try {
    const product = await Product.findOne(query).select('mifosProductId productCode').lean();
    if (product?.mifosProductId) {
      return product.mifosProductId;
    }
  } catch (err) {
    logger.warn('Product resolver lookup failed', { productCode: code, tenantId, error: err.message });
  }

  if (/^\d+$/.test(code)) {
    return parseInt(code, 10);
  }

  return DEFAULT_MIFOS_PRODUCT_ID;
}

module.exports = {
  resolveMifosProductId,
  DEFAULT_MIFOS_PRODUCT_ID,
};
