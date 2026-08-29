const { getTenantLoanRows, DELINQUENCY_BUCKET_DEFS } = require('./fineractLoanRows');
const { getFineractIncomeEntries } = require('./fineractIncomeSummary');
const { getTenantClientContactsById } = require('./fineractClients');
const api = require('./cbs.api');
const { runWithTenantContext } = require('../utils/tenantContext');
const logger = require('../utils/logger');

// Row-level data behind each Dashboard MiraCore Summary card, for the click-through detail
// pages. Every metric here is filtered/shaped from the exact same cached row list the
// aggregate cards are computed from (fineractLoanRows.js) - or, for interest/fee income, the
// same journal-entry fetch fineractIncomeSummary.js's aggregate uses - so a detail page's
// rows always reconcile back to its card's headline figure.
//
// "range" ({ from: Date, to: Date }) only applies to the metrics that are actually time-scoped
// (disbursed, interest/fee income, collection rate - see dashboardController.js's per-metric
// point-in-time list). Point-in-time metrics (portfolio, par30, borrowers, delinquency
// buckets) ignore it and always reflect current state - same rule as the summary cards.

function isSameMonth(isoDate, referenceDate) {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  return d.getFullYear() === referenceDate.getFullYear() && d.getMonth() === referenceDate.getMonth();
}

function isInRange(isoDate, from, to) {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  return d >= from && d <= to;
}

function isDisbursedInScope(loan, range) {
  return range ? isInRange(loan.actualDisbursementDate, range.from, range.to) : isSameMonth(loan.actualDisbursementDate, new Date());
}

const DELINQUENCY_BUCKET_KEYS = new Set(DELINQUENCY_BUCKET_DEFS.map((b) => b.key));

function fineractDateToDateOnlyString(fineractDateArray) {
  if (!Array.isArray(fineractDateArray) || fineractDateArray.length < 3) return null;
  const [year, month, day] = fineractDateArray;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Last Repayment Date isn't on the /v1/loans list endpoint (confirmed live: its `delinquent`
// sub-object omits lastRepaymentDate/lastPaymentDate/nextPaymentDueDate, present only on
// GET /v1/loans/{id} - even without ?associations=all). Only fetched here, for the specific
// loans shown on one bucket's detail page (never the full portfolio sweep) - a bucket's real
// size is single digits today, but this chunks concurrency rather than firing one unbounded
// Promise.all, so it stays safe if a bucket ever holds many more loans. LOAN_DETAIL_CHUNK_SIZE
// is the threshold: at most this many single-loan GETs in flight to Fineract at once.
const LOAN_DETAIL_CHUNK_SIZE = 8;

async function fetchLastRepaymentDates(tenantId, loanIds) {
  const results = new Map(); // loanId -> date-only string | null

  for (let i = 0; i < loanIds.length; i += LOAN_DETAIL_CHUNK_SIZE) {
    const chunk = loanIds.slice(i, i + LOAN_DETAIL_CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (loanId) => {
        try {
          const response = await runWithTenantContext({ tenantId }, () => api.maker.get(`/v1/loans/${loanId}`));
          return [loanId, fineractDateToDateOnlyString(response.data?.delinquent?.lastRepaymentDate)];
        } catch (err) {
          logger.warn('Fineract last-repayment-date fetch failed for loan', { tenantId, loanId, error: err.message });
          return [loanId, null];
        }
      })
    );
    chunkResults.forEach(([loanId, date]) => results.set(loanId, date));
  }

  return results;
}

/**
 * @param {string} metric - one of: portfolio, par30, disbursed, borrowers, collection-rate,
 *   interest-income, fee-income, or delinquency-<bucketKey> (e.g. delinquency-days_1_30)
 * @param {string|null} tenantId
 * @param {{from: Date, to: Date}|null} range - only consulted for time-scoped metrics
 */
async function getDashboardDetail(metric, tenantId, range) {
  if (metric.startsWith('delinquency-')) {
    const bucketKey = metric.slice('delinquency-'.length);
    if (!DELINQUENCY_BUCKET_KEYS.has(bucketKey)) {
      throw Object.assign(new Error(`Unknown delinquency bucket: ${bucketKey}`), { statusCode: 400 });
    }
    const rows = await getTenantLoanRows(tenantId);
    const bucketLoans = rows.filter((l) => l.isActive && l.delinquencyBucket === bucketKey);

    // Both enrichments below are scoped to just this bucket's loans, not the whole portfolio:
    // client contacts is one batched call regardless (cheap either way), but last-repayment-date
    // is a per-loan call, so keeping it bucket-scoped matters.
    const [contactsById, lastRepaymentByLoanId] = await Promise.all([
      getTenantClientContactsById(tenantId),
      fetchLastRepaymentDates(tenantId, bucketLoans.map((l) => l.loanId))
    ]);

    return bucketLoans.map((l) => {
      const contact = contactsById.get(l.clientId) || {};
      return {
        loanAccountNo: l.accountNo,
        clientName: l.clientName,
        clientExternalId: l.clientExternalId,
        mobileNo: contact.mobileNo || null,
        emailAddress: contact.emailAddress || null,
        principalDisbursed: l.principalDisbursed,
        interestCharged: l.interestCharged,
        penaltyChargesCharged: l.penaltyChargesCharged,
        principalPaid: l.principalPaid,
        interestPaid: l.interestPaid,
        penaltyChargesPaid: l.penaltyChargesPaid,
        totalCollected: l.totalRepayment,
        principalOutstanding: l.principalOutstanding,
        interestOutstanding: l.interestOutstanding,
        penaltyChargesOutstanding: l.penaltyChargesOutstanding,
        totalOutstanding: l.totalOutstanding,
        pastDueDays: l.pastDueDays,
        disbursementDate: l.actualDisbursementDate,
        lastRepaymentDate: lastRepaymentByLoanId.get(l.loanId) || null
      };
    });
  }

  switch (metric) {
    case 'portfolio': {
      const rows = await getTenantLoanRows(tenantId);
      return rows
        .filter((l) => l.isActive)
        .map((l) => ({
          loanAccountNo: l.accountNo,
          clientName: l.clientName,
          clientExternalId: l.clientExternalId,
          principal: l.principal,
          principalOutstanding: l.principalOutstanding,
          status: l.statusValue
        }));
    }

    case 'par30': {
      const rows = await getTenantLoanRows(tenantId);
      return rows
        .filter((l) => l.isActive && l.pastDueDays >= 30)
        .map((l) => ({
          loanAccountNo: l.accountNo,
          clientName: l.clientName,
          clientExternalId: l.clientExternalId,
          principalOutstanding: l.principalOutstanding,
          pastDueDays: l.pastDueDays,
          delinquencyBucket: l.delinquencyBucket
        }));
    }

    case 'disbursed': {
      const rows = await getTenantLoanRows(tenantId);
      return rows
        .filter((l) => isDisbursedInScope(l, range))
        .map((l) => ({
          loanAccountNo: l.accountNo,
          clientName: l.clientName,
          clientExternalId: l.clientExternalId,
          principal: l.principal,
          disbursementDate: l.actualDisbursementDate
        }));
    }

    case 'borrowers': {
      const rows = await getTenantLoanRows(tenantId);
      const byClient = new Map();
      rows.filter((l) => l.isActive).forEach((l) => {
        const existing = byClient.get(l.clientId) || {
          clientId: l.clientId,
          clientName: l.clientName,
          clientExternalId: l.clientExternalId,
          loanCount: 0,
          totalOutstanding: 0
        };
        existing.loanCount += 1;
        existing.totalOutstanding += l.principalOutstanding;
        byClient.set(l.clientId, existing);
      });
      return Array.from(byClient.values()).map((c) => ({
        ...c,
        totalOutstanding: parseFloat(c.totalOutstanding.toFixed(2))
      }));
    }

    case 'collection-rate': {
      const rows = await getTenantLoanRows(tenantId);
      return rows
        .filter((l) => l.totalExpectedRepayment > 0)
        .map((l) => ({
          loanAccountNo: l.accountNo,
          clientName: l.clientName,
          clientExternalId: l.clientExternalId,
          totalRepayment: l.totalRepayment,
          totalExpectedRepayment: l.totalExpectedRepayment,
          ratePercent: parseFloat(((l.totalRepayment / l.totalExpectedRepayment) * 100).toFixed(2))
        }));
    }

    case 'interest-income':
      return getFineractIncomeEntries(tenantId, 'interest', range);

    case 'fee-income':
      return getFineractIncomeEntries(tenantId, 'fee', range);

    default:
      throw Object.assign(new Error(`Unknown dashboard metric: ${metric}`), { statusCode: 400 });
  }
}

module.exports = { getDashboardDetail };
