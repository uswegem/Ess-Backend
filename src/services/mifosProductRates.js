const logger = require('../utils/logger');
const api = require('./cbs.api').maker;
const { API_ENDPOINTS } = require('./cbs.endpoints');
const { resolveMifosProductId } = require('./productResolver');

// Charge names this system understands, as configured on the Fineract loan product.
// Matched case-insensitively against Fineract's charges[].name - Fineract has no stable
// machine-readable "kind" for a charge beyond its free-text name, so this is the only
// reliable way to identify "the processing fee" / "the insurance charge" among a product's
// configured charges.
const PROCESSING_FEE_CHARGE_NAME = 'processing fee';
const INSURANCE_CHARGE_NAME = 'insurance';
const PERCENT_CALCULATION_TYPE = '% Amount';

class FineractProductRateError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'FineractProductRateError';
    this.details = details;
  }
}

// Short-lived cache so a burst of quote requests for the same product doesn't hit Fineract
// once per request - rates change rarely enough that a short TTL is safe, but short enough
// that an admin editing a product in Fineract is reflected quickly.
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // `${tenantId}:${productCode}` -> { data, expiresAt }

function cacheKey(tenantId, productCode) {
  return `${tenantId || 'no-tenant'}:${productCode}`;
}

function findChargeByName(charges, name) {
  return (charges || []).find(
    (c) => typeof c.name === 'string' && c.name.trim().toLowerCase() === name
  );
}

/**
 * Resolve the real, live interest rate and charge percentages for a product directly from
 * Fineract - not from LOAN_CONSTANTS, not from the (currently stale/incomplete) Mongo
 * Product collection. Fails closed: any missing/unrecognized piece of data throws
 * FineractProductRateError rather than silently substituting a default, since a wrong
 * silently-substituted rate is a worse outcome than a rejected quote.
 *
 * @param {string} productCode - MiraCore product code (e.g. "17")
 * @param {string|null} tenantId - active tenant id, or null for untenanted/legacy requests
 * @returns {Promise<{
 *   mifosProductId: number,
 *   interestRatePerPeriod: number,
 *   interestRateFrequencyType: number,
 *   processingFeeRate: number,   // as a fraction, e.g. 0.02 for 2%
 *   insuranceRate: number,       // as a fraction, e.g. 0.0075 for 0.75%
 * }>}
 */
async function getMifosProductRates(productCode, tenantId = null) {
  const key = cacheKey(tenantId, productCode);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const mifosProductId = await resolveMifosProductId(productCode, tenantId);

  let response;
  try {
    response = await api.get(`${API_ENDPOINTS.PRODUCT}/${mifosProductId}`);
  } catch (err) {
    throw new FineractProductRateError(
      `Failed to fetch loan product ${mifosProductId} (productCode=${productCode}) from Fineract: ${err.message}`,
      { productCode, tenantId, mifosProductId, cause: err }
    );
  }

  const product = response?.data;
  if (!product) {
    throw new FineractProductRateError(
      `Fineract returned no data for loan product ${mifosProductId} (productCode=${productCode})`,
      { productCode, tenantId, mifosProductId }
    );
  }

  const interestRatePerPeriod = product.interestRatePerPeriod;
  if (interestRatePerPeriod == null) {
    throw new FineractProductRateError(
      `Loan product ${mifosProductId} (productCode=${productCode}) has no interestRatePerPeriod configured in Fineract`,
      { productCode, tenantId, mifosProductId }
    );
  }

  const processingFeeCharge = findChargeByName(product.charges, PROCESSING_FEE_CHARGE_NAME);
  const insuranceCharge = findChargeByName(product.charges, INSURANCE_CHARGE_NAME);

  if (!processingFeeCharge) {
    throw new FineractProductRateError(
      `Loan product ${mifosProductId} (productCode=${productCode}) has no "${PROCESSING_FEE_CHARGE_NAME}" charge configured in Fineract`,
      { productCode, tenantId, mifosProductId }
    );
  }
  if (!insuranceCharge) {
    throw new FineractProductRateError(
      `Loan product ${mifosProductId} (productCode=${productCode}) has no "${INSURANCE_CHARGE_NAME}" charge configured in Fineract`,
      { productCode, tenantId, mifosProductId }
    );
  }

  for (const [label, charge] of [['Processing Fee', processingFeeCharge], ['Insurance', insuranceCharge]]) {
    if (charge.chargeCalculationType?.value !== PERCENT_CALCULATION_TYPE) {
      throw new FineractProductRateError(
        `Loan product ${mifosProductId} (productCode=${productCode})'s "${label}" charge is not "${PERCENT_CALCULATION_TYPE}" ` +
          `(got "${charge.chargeCalculationType?.value}") - this resolver only supports percentage-of-amount charges today`,
        { productCode, tenantId, mifosProductId }
      );
    }
    if (charge.amount == null) {
      throw new FineractProductRateError(
        `Loan product ${mifosProductId} (productCode=${productCode})'s "${label}" charge has no amount configured`,
        { productCode, tenantId, mifosProductId }
      );
    }
  }

  const data = {
    mifosProductId,
    interestRatePerPeriod,
    interestRateFrequencyType: product.interestRateFrequencyType?.id,
    processingFeeRate: processingFeeCharge.amount / 100,
    insuranceRate: insuranceCharge.amount / 100
  };

  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  logger.info('Resolved Fineract product rates', { productCode, tenantId, ...data });
  return data;
}

function clearProductRatesCache() {
  cache.clear();
}

module.exports = {
  getMifosProductRates,
  clearProductRatesCache,
  FineractProductRateError
};
