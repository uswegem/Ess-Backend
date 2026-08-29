const logger = require('../utils/logger');
const { getTenantLoanRows, DELINQUENCY_BUCKET_DEFS } = require('./fineractLoanRows');

// MiraCore (Fineract-sourced) portfolio metrics for the Dashboard executive summary.
// Aggregates from fineractLoanRows.js's shared, cached row list rather than paging Fineract
// itself - guarantees this card's aggregate figures always sum back exactly to what the
// click-through detail pages (dashboardDetailService.js) show, since both read the same rows.
//
// "Total outstanding portfolio" and PAR30 are principal-only (summary.principalOutstanding),
// the standard microfinance portfolio definition - not summary.totalOutstanding, which also
// bundles accrued interest/fees.
//
// PAR30/delinquency-bucket arrears-age is derived from summary.overdueSinceDate, NOT from
// Fineract's own delinquent.pastDueDays field - see fineractLoanRows.js's module comment for
// why (verified live: pastDueDays reads 0 on every loan regardless of real arrears on this
// deployment).
//
// Collection rate = totalRepayment / totalExpectedRepayment across every loan that has a
// summary (active and closed) - this is a genuinely Fineract-only figure. LoanMapping/Mongo
// has no repayment-transaction data at all; it only tracks the ESS message-driven
// application pipeline (see essLoanSummary.js), so this metric cannot be sourced from there.
//
// NOT range-scoped, even though the Dashboard's date-range control otherwise applies to it:
// totalRepayment/totalExpectedRepayment are lifetime-cumulative fields on each loan's Fineract
// summary - there's no "repaid within this date range" figure available without fetching each
// loan's individual transaction history (a separate paginated call per loan, N+1 - not the
// "page /v1/loans once" pattern everything else here relies on). Always reflects lifetime
// collection performance regardless of the selected range. Flagged, not silently faked.

function isInRange(isoDate, from, to) {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  return d >= from && d <= to;
}

// UTC-midnight `from`, matching the UTC-midnight convention fineractLoanRows.js's
// actualDisbursementDate now uses (see that file's comment) - keeps this fallback consistent
// with the caller-supplied range case, where dashboardController.js parses frontend
// "yyyy-MM-dd" strings via `new Date(str)`, which is also UTC-midnight per the ISO 8601 spec.
function defaultThisMonthRange() {
  const now = new Date();
  return { from: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)), to: now };
}

// Card-level bucket shape: Bucket | No. Loans | Principal Disbursed | Principal/Interest
// Outstanding | Total Outstanding | Total Collected - the compact 7-column set for the
// Dashboard card. penaltyOutstanding is still computed here (cheap, already in the same
// loop) but not surfaced on the card - kept in the response in case another consumer wants
// it later. The full booked/collected/outstanding breakdown per component, including
// Penalty Outstanding, lives on the click-through detail page instead
// (dashboardDetailService.js), computed per-loan there - a bucket-level card showing all 11
// figures would be unreadable, per the earlier design decision.
function emptyDelinquencyBuckets() {
  const buckets = {};
  DELINQUENCY_BUCKET_DEFS.forEach((b) => {
    buckets[b.key] = {
      label: b.label,
      count: 0,
      principalDisbursed: 0,
      principalOutstanding: 0,
      interestOutstanding: 0,
      penaltyOutstanding: 0,
      totalOutstanding: 0,
      totalCollected: 0,
    };
  });
  return buckets;
}

function aggregateFromRows(rows, range) {
  const effectiveRange = range || defaultThisMonthRange();

  let activeLoans = 0;
  let totalOutstandingPrincipal = 0;
  let totalOutstandingAllComponents = 0; // principal+interest+penalty, active loans only - the NPL ratio's denominator
  let par30OutstandingPrincipal = 0;
  let principalPaidTotal = 0;
  let interestPaidTotal = 0;
  let disbursedThisMonthCount = 0;
  let disbursedThisMonthAmount = 0;
  let totalRepayment = 0;
  let totalExpectedRepayment = 0;
  const activeBorrowerIds = new Set();
  const delinquencyBuckets = emptyDelinquencyBuckets();

  for (const loan of rows) {
    if (loan.isActive) {
      activeLoans += 1;
      activeBorrowerIds.add(loan.clientId);
      totalOutstandingPrincipal += loan.principalOutstanding;
      totalOutstandingAllComponents += loan.totalOutstanding;
      principalPaidTotal += loan.principalPaid;
      interestPaidTotal += loan.interestPaid;

      if (loan.pastDueDays >= 30) {
        par30OutstandingPrincipal += loan.principalOutstanding;
      }

      const bucket = delinquencyBuckets[loan.delinquencyBucket];
      bucket.count += 1;
      bucket.principalDisbursed += loan.principalDisbursed;
      bucket.principalOutstanding += loan.principalOutstanding;
      bucket.interestOutstanding += loan.interestOutstanding;
      bucket.penaltyOutstanding += loan.penaltyChargesOutstanding;
      bucket.totalOutstanding += loan.totalOutstanding;
      bucket.totalCollected += loan.totalRepayment;
    }

    totalRepayment += loan.totalRepayment;
    totalExpectedRepayment += loan.totalExpectedRepayment;

    if (isInRange(loan.actualDisbursementDate, effectiveRange.from, effectiveRange.to)) {
      disbursedThisMonthCount += 1;
      disbursedThisMonthAmount += loan.principal;
    }
  }

  const par30Percent = totalOutstandingPrincipal > 0
    ? parseFloat(((par30OutstandingPrincipal / totalOutstandingPrincipal) * 100).toFixed(2))
    : 0;
  const collectionRatePercent = totalExpectedRepayment > 0
    ? parseFloat(((totalRepayment / totalExpectedRepayment) * 100).toFixed(2))
    : 0;

  Object.values(delinquencyBuckets).forEach((b) => {
    b.principalDisbursed = parseFloat(b.principalDisbursed.toFixed(2));
    b.principalOutstanding = parseFloat(b.principalOutstanding.toFixed(2));
    b.interestOutstanding = parseFloat(b.interestOutstanding.toFixed(2));
    b.penaltyOutstanding = parseFloat(b.penaltyOutstanding.toFixed(2));
    b.totalOutstanding = parseFloat(b.totalOutstanding.toFixed(2));
    b.totalCollected = parseFloat(b.totalCollected.toFixed(2));
  });

  // NPL = the 90+ days delinquency bucket, confirmed as equivalent (same underlying loan set,
  // no separate threshold/calculation) - reuses that bucket's own (now-rounded)
  // totalOutstanding directly, so the NPL card's TZS amount is always identical to what the
  // Delinquency Buckets table's 90+ row shows, never a fraction of a cent off from rounding
  // order. Numerator and denominator are both "total outstanding" (principal+interest+
  // penalty), not principal-only, to keep the ratio's units consistent - deliberately not
  // reusing total_outstanding_portfolio (that figure is principal-only, see module comment)
  // as the denominator, which would mismatch against a total-outstanding numerator.
  const nplAmount = delinquencyBuckets.days_90_plus.totalOutstanding;
  const nplPercent = totalOutstandingAllComponents > 0
    ? parseFloat(((nplAmount / totalOutstandingAllComponents) * 100).toFixed(2))
    : 0;

  return {
    total_loans: rows.length,
    active_loans: activeLoans,
    total_outstanding_portfolio: parseFloat(totalOutstandingPrincipal.toFixed(2)),
    par30_percent: par30Percent, // kept computed (cheap, unused by any card now) - still backs the par30 detail/export route
    npl_percent: nplPercent,
    npl_amount: parseFloat(nplAmount.toFixed(2)),
    loans_disbursed_this_month_count: disbursedThisMonthCount,
    loans_disbursed_this_month_amount: parseFloat(disbursedThisMonthAmount.toFixed(2)),
    active_borrowers: activeBorrowerIds.size,
    principal_paid_total: parseFloat(principalPaidTotal.toFixed(2)),
    interest_paid_total: parseFloat(interestPaidTotal.toFixed(2)),
    collection_rate_percent: collectionRatePercent,
    delinquency_buckets: delinquencyBuckets
  };
}

/**
 * @param {string|null} tenantId - null/omitted means cross-tenant (every tenant's rows combined)
 * @param {{from: Date, to: Date}|null} range - only affects loans_disbursed_*; every other
 *   figure (portfolio, NPL, borrowers, principal/interest paid, delinquency buckets,
 *   collection rate) is point-in-time or lifetime and ignores this - see module comment.
 */
async function getFineractPortfolioSummary(tenantId = null, range = null) {
  try {
    const rows = await getTenantLoanRows(tenantId);
    return aggregateFromRows(rows, range);
  } catch (err) {
    logger.warn('Fineract portfolio-summary aggregation failed', { tenantId, error: err.message });
    return aggregateFromRows([], range);
  }
}

module.exports = { getFineractPortfolioSummary };
