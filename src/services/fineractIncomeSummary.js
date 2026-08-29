const logger = require('../utils/logger');
const Tenant = require('../models/Tenant');
const api = require('./cbs.api');
const { runWithTenantContext } = require('../utils/tenantContext');
const { getTenantLoanRows } = require('./fineractLoanRows');

// Interest/fee income for the Dashboard's MiraCore Summary, sourced from Fineract's
// accounting journal entries (GL account activity), not from loan.summary fields -
// summary.interestCharged/feeChargesCharged are lifetime-accrued totals, not range-scoped,
// and don't reflect what was actually recognized as income in a given window.
//
// GL accounts confirmed live on this tenant's chart of accounts (see /v1/glaccounts?type=4):
//   Interest Income family: id 30 "Interest Income" (4100), id 31 "Loan Interest Income" (4101)
//   Fee Income family:      id 33 "Fee Income" (4200), id 34 "Loan Processing Fees" (4201)
// Both parent and the loan-specific child account are queried per family in case posting
// ever moves between them - only account 31 has entries today, but this shouldn't need
// updating if that changes.
//
// IMPORTANT: as of this writing, every loan is created with `charges: []` (see
// apiController.js - "Empty charges array to avoid MIFOS NPE bug"), so fee income will
// correctly read 0 here. That's a real product/booking gap (processing fee and insurance
// amounts ARE quoted to customers in ESS/Mongo metadata.loanData, just never booked into
// Fineract), not a bug in this calculation - do not "fix" this metric by pulling fee
// amounts from Mongo, which would hide the gap rather than surface it.

const INTEREST_INCOME_GL_IDS = [30, 31];
const FEE_INCOME_GL_IDS = [33, 34];

const CACHE_TTL_MS = 2 * 60 * 1000;
const JOURNAL_ENTRY_PAGE_LIMIT = 1000;

const cache = new Map(); // `${tenantId}:${kind}:${fromDate}:${toDate}` -> { data, expiresAt }

// Formats a Date as a plain yyyy-MM-dd calendar-date string for Fineract's date-only API
// params. Deliberately NOT `d.toISOString().split('T')[0]` - on a server running ahead of UTC
// (this one is EAT, UTC+3), a locally-constructed midnight Date (e.g. `new Date(y, m, 1)`)
// serializes via toISOString() into the *previous* UTC calendar day (Aug 1 00:00 EAT ==
// Jul 31 21:00 UTC), silently shifting the range sent to Fineract back by a day every month.
// Reading the Date's own UTC-agnostic *local* calendar fields keeps the string matching what
// was actually intended, regardless of server timezone.
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultThisMonthRange() {
  const now = new Date();
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

// Fineract dates arrive as [yyyy, M, d] (1-based month). Building a plain "yyyy-MM-dd" string
// directly from those components - no Date object, no toISOString() - sidesteps the same
// timezone round-trip issue formatDate() has to guard against above; there's no timezone to
// get wrong if a Date object is never constructed for a value that's just being displayed.
function fineractDateToDateOnlyString(fineractDateArray) {
  if (!Array.isArray(fineractDateArray) || fineractDateArray.length < 3) return null;
  const [year, month, day] = fineractDateArray;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Raw, unenriched journal entries (credit-side only, unreversed) for a GL account family
// within a date range. This is the row-level data behind both the aggregate sum and the
// detail-page listing - fetched once per (tenant, kind, range) and cached, so both consumers
// pay the Fineract cost only once.
async function fetchGlCreditEntries(tenantId, glAccountIds, from, to) {
  const fromDate = formatDate(from);
  const toDate = formatDate(to);
  const entries = [];

  for (const glAccountId of glAccountIds) {
    let offset = 0;
    for (;;) {
      const response = await runWithTenantContext({ tenantId }, () =>
        api.maker.get('/v1/journalentries', {
          params: {
            glAccountId,
            fromDate,
            toDate,
            dateFormat: 'yyyy-MM-dd',
            locale: 'en',
            limit: JOURNAL_ENTRY_PAGE_LIMIT,
            offset
          }
        })
      );
      const items = response.data?.pageItems || [];
      if (items.length === 0) break;

      for (const entry of items) {
        if (entry.entryType?.code === 'journalEntryType.credit' && !entry.reversed) {
          entries.push({
            date: fineractDateToDateOnlyString(entry.transactionDate),
            amount: entry.amount || 0,
            loanId: entry.entityType?.code === 'productType.loan' ? entry.entityId : null,
            transactionId: entry.transactionId
          });
        }
      }

      offset += items.length;
      if (items.length < JOURNAL_ENTRY_PAGE_LIMIT) break;
    }
  }
  return entries;
}

async function getCachedGlCreditEntries(tenantId, kind, range) {
  const glAccountIds = kind === 'interest' ? INTEREST_INCOME_GL_IDS : FEE_INCOME_GL_IDS;
  const { from, to } = range || defaultThisMonthRange();
  const key = `${tenantId || '__all__'}:${kind}:${formatDate(from)}:${formatDate(to)}`;

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let entries;
  if (tenantId) {
    entries = await fetchGlCreditEntries(tenantId, glAccountIds, from, to);
  } else {
    const tenants = await Tenant.find({}).select('tenantId').lean();
    const perTenant = await Promise.all(
      tenants.map(async (t) => {
        try {
          return await fetchGlCreditEntries(t.tenantId, glAccountIds, from, to);
        } catch (err) {
          logger.warn('Fineract journal-entry fetch failed for tenant', { tenantId: t.tenantId, kind, error: err.message });
          return [];
        }
      })
    );
    entries = perTenant.flat();
  }

  cache.set(key, { data: entries, expiresAt: Date.now() + CACHE_TTL_MS });
  return entries;
}

/**
 * @param {string|null} tenantId
 * @param {{from: Date, to: Date}|null} range - defaults to the current calendar month
 */
async function getFineractIncomeSummary(tenantId = null, range = null) {
  try {
    const [interestEntries, feeEntries] = await Promise.all([
      getCachedGlCreditEntries(tenantId, 'interest', range),
      getCachedGlCreditEntries(tenantId, 'fee', range)
    ]);
    const sum = (entries) => parseFloat(entries.reduce((total, e) => total + e.amount, 0).toFixed(2));
    return { interest_income_this_month: sum(interestEntries), fee_income_this_month: sum(feeEntries) };
  } catch (err) {
    logger.warn('Fineract income-summary fetch failed', { tenantId, error: err.message });
    return { interest_income_this_month: 0, fee_income_this_month: 0 };
  }
}

/**
 * Row-level detail behind Interest/Fee Income cards, enriched with client name/loan account
 * by joining against the same cached loan-rows list the rest of the Dashboard uses (avoids an
 * extra Fineract call per journal entry - journal entries only carry entityId=loanId).
 *
 * @param {string|null} tenantId
 * @param {'interest'|'fee'} kind
 * @param {{from: Date, to: Date}|null} range
 */
async function getFineractIncomeEntries(tenantId, kind, range) {
  const [entries, loanRows] = await Promise.all([
    getCachedGlCreditEntries(tenantId, kind, range),
    getTenantLoanRows(tenantId)
  ]);
  const loanById = new Map(loanRows.map((l) => [l.loanId, l]));

  return entries.map((e) => {
    const loan = e.loanId != null ? loanById.get(e.loanId) : null;
    return {
      date: e.date,
      amount: e.amount,
      loanAccountNo: loan?.accountNo || null,
      clientName: loan?.clientName || null,
      clientExternalId: loan?.clientExternalId || null
    };
  });
}

module.exports = { getFineractIncomeSummary, getFineractIncomeEntries };
