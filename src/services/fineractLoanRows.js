const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');
const api = require('./cbs.api');
const { runWithTenantContext } = require('../utils/tenantContext');

// Single shared source of row-level loan data for both the Dashboard's aggregate MiraCore
// Summary figures (fineractPortfolioSummary.js) and its click-through detail pages
// (dashboardDetailService.js). Pages /v1/loans exactly once per tenant per cache window and
// classifies each loan (delinquency bucket, arrears age) the same way for both consumers, so
// a detail page's rows always sum back to exactly the aggregate card's figure - no risk of
// the two drifting apart from separately-implemented filtering logic.
//
// See fineractPortfolioSummary.js's module comment for why: (a) this Fineract deployment
// ignores server-side filters on GET /v1/loans (full paging required), and (b) arrears age is
// derived from summary.overdueSinceDate rather than the unreliable delinquent.pastDueDays.

const CACHE_TTL_MS = 2 * 60 * 1000; // matches fineractPortfolioSummary.js's cache window
const FINERACT_LOAN_PAGE_LIMIT = 1000;

const cache = new Map(); // tenantId ('__all__' for cross-tenant) -> { data, expiresAt }

const DELINQUENCY_BUCKET_DEFS = [
  { key: 'current', label: 'Current', min: -Infinity, max: 0 },
  { key: 'days_1_30', label: '1-30 days', min: 1, max: 30 },
  { key: 'days_31_60', label: '31-60 days', min: 31, max: 60 },
  { key: 'days_61_90', label: '61-90 days', min: 61, max: 90 },
  { key: 'days_90_plus', label: '90+ days', min: 91, max: Infinity },
];

function classifyDelinquencyBucket(pastDueDays) {
  return DELINQUENCY_BUCKET_DEFS.find((b) => pastDueDays >= b.min && pastDueDays <= b.max).key;
}

function daysSince(fineractDateArray, referenceDate) {
  if (!Array.isArray(fineractDateArray) || fineractDateArray.length < 3) return 0;
  const [year, month, day] = fineractDateArray; // Fineract dates are [yyyy, M, d], 1-based month
  const since = new Date(year, month - 1, day);
  return Math.floor((referenceDate.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));
}

// UTC-midnight, not local-midnight-then-toISOString(). This value gets compared against
// date-range boundaries parsed from frontend "yyyy-MM-dd" strings elsewhere (Stage 3's
// dashboardController.js), which parse as UTC midnight per the ISO 8601 date-only spec. On a
// server running ahead of UTC (this one is EAT, UTC+3), local-midnight-then-toISOString()
// would serialize to an instant *before* UTC midnight of the same calendar date, causing a
// loan genuinely disbursed "today" to be silently excluded from a "from today" range filter -
// the same class of bug fixed in fineractIncomeSummary.js's formatDate(). Using Date.UTC
// directly keeps this value on the same UTC-midnight convention as those range boundaries.
function fineractDateToISO(fineractDateArray) {
  if (!Array.isArray(fineractDateArray) || fineractDateArray.length < 3) return null;
  const [year, month, day] = fineractDateArray;
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function normalizeLoan(loan, now) {
  const isActive = loan.status?.active === true;
  const s = loan.summary || {};
  const principalOutstanding = s.principalOutstanding || 0;
  const isOverdue = isActive && (s.totalOverdue || 0) > 0 && s.overdueSinceDate;
  const pastDueDays = isOverdue ? daysSince(s.overdueSinceDate, now) : 0;

  return {
    loanId: loan.id,
    accountNo: loan.accountNo,
    clientId: loan.clientId,
    clientName: loan.clientName,
    clientExternalId: loan.clientExternalId,
    productName: loan.loanProductName,
    principal: loan.principal || 0,
    principalOutstanding: isActive ? principalOutstanding : 0,
    isActive,
    statusValue: loan.status?.value || 'Unknown',
    pastDueDays,
    delinquencyBucket: isActive ? classifyDelinquencyBucket(pastDueDays) : null,
    actualDisbursementDate: fineractDateToISO(loan.timeline?.actualDisbursementDate),
    totalRepayment: s.totalRepayment || 0,
    totalExpectedRepayment: s.totalExpectedRepayment || 0,

    // Principal/interest/penalty booked-collected-outstanding breakdown, for the
    // Delinquency Buckets card + its per-loan detail page. Field names confirmed live
    // against this Fineract deployment's actual /v1/loans response (both list and
    // single-loan GET carry these identically) - see fineractPortfolioSummary.js's
    // module comment for the full field-name confirmation writeup.
    principalDisbursed: s.principalDisbursed || 0,
    interestCharged: s.interestCharged || 0,
    penaltyChargesCharged: s.penaltyChargesCharged || 0,
    principalPaid: s.principalPaid || 0,
    interestPaid: s.interestPaid || 0,
    penaltyChargesPaid: s.penaltyChargesPaid || 0,
    interestOutstanding: s.interestOutstanding || 0,
    penaltyChargesOutstanding: s.penaltyChargesOutstanding || 0,
    totalOutstanding: s.totalOutstanding || 0,

    // Waived/written-off amounts, kept only to explain expected small deviations in the
    // principalDisbursed - principalPaid ≈ principalOutstanding sanity check (and the
    // interest/penalty equivalents) - not shown on either the card or the detail page.
    principalWrittenOff: s.principalWrittenOff || 0,
    principalAdjustments: s.principalAdjustments || 0,
    interestWaived: s.interestWaived || 0,
    interestWrittenOff: s.interestWrittenOff || 0,
    penaltyChargesWaived: s.penaltyChargesWaived || 0,
    penaltyChargesWrittenOff: s.penaltyChargesWrittenOff || 0,
  };
}

async function fetchTenantLoanRows(tenantId) {
  const now = new Date();
  const rows = [];
  let offset = 0;

  for (;;) {
    const response = await runWithTenantContext({ tenantId }, () =>
      api.maker.get('/v1/loans', { params: { limit: FINERACT_LOAN_PAGE_LIMIT, offset } })
    );
    const items = response.data?.pageItems || [];
    if (items.length === 0) break;

    items.forEach((loan) => rows.push(normalizeLoan(loan, now)));

    offset += items.length;
    if (items.length < FINERACT_LOAN_PAGE_LIMIT) break; // short page = last page
  }

  return rows;
}

async function fetchAllTenantsLoanRows() {
  const tenants = await Tenant.find({}).select('tenantId').lean();
  const results = await Promise.all(
    tenants.map(async (t) => {
      try {
        return await fetchTenantLoanRows(t.tenantId);
      } catch (err) {
        logger.warn('Fineract loan-rows fetch failed for tenant', { tenantId: t.tenantId, error: err.message });
        return [];
      }
    })
  );
  return results.flat();
}

/**
 * @param {string|null} tenantId - null/omitted means cross-tenant (every tenant's rows combined)
 * @returns {Promise<Array>} normalized, classified loan rows (see normalizeLoan)
 */
async function getTenantLoanRows(tenantId = null) {
  const key = tenantId || '__all__';
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = tenantId ? await fetchTenantLoanRows(tenantId) : await fetchAllTenantsLoanRows();

  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

module.exports = { getTenantLoanRows, DELINQUENCY_BUCKET_DEFS, classifyDelinquencyBucket };
