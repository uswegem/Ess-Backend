const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
// Required for activity()'s AuditLog.find(...).populate('userId', ...) below - this
// controller never otherwise references the User model directly, so Mongoose has no
// guarantee it's been registered on this connection by the time populate() runs here,
// regardless of what else has (or hasn't) been required elsewhere in the request path.
// eslint-disable-next-line no-unused-vars
const User = require('../models/User');
const TenantUser = require('../models/TenantUser');
const logger = require('../utils/logger');
const { buildEssLoanSummary } = require('../utils/essLoanSummary');
const { maker: cbsApi } = require('../services/cbs.api');

function mifosDate(value) {
  return Array.isArray(value) ? new Date(Date.UTC(value[0], value[1] - 1, value[2])) : null;
}

function inDateRange(value, from, to) {
  if (!value) return false;
  return (!from || value >= from) && (!to || value <= to);
}

// Interest actually earned as of a given date, cumulative from disbursement through
// asOfDate. Two candidate figures, both computed from this loan's own posted transactions
// (associations=transactions - NOT the repayment schedule, which is a pure calendar-time
// snapshot with the same limitation described below):
//   - accrual: sum of daily "Accrual" transactions' interestPortion up to asOfDate. This is
//     Fineract's own real day-by-day accrual engine (confirmed running correctly on this
//     deployment - not a broken/stale COB job), so it's the accurate answer to "how much
//     interest has this loan earned purely through elapsed time".
//   - paid: sum of "Repayment"/"Recovery Repayment" transactions' interestPortion up to
//     asOfDate - interest actually collected.
// The result is max(accrual, paid), not accrual alone: a customer who pays ahead of schedule
// (confirmed on real loans this deployment - e.g. a customer paying 200,000/month against a
// much smaller contractual installment) has genuinely already paid interest tied to periods
// whose calendar time hasn't elapsed yet. Once collected, that interest is unambiguously
// earned - a pure time-elapsed accrual model has no way to represent that, since it only
// asks "how much time has passed", not "has this obligation already been settled". This
// floor is a deliberate, considered design choice, not a stopgap - see docs/KNOWN_GAPS.md.
function earnedInterestAsOf(transactions, asOfDate) {
  let accrual = 0;
  let paid = 0;
  for (const t of (transactions || [])) {
    const txDate = mifosDate(t.date);
    if (!txDate || txDate > asOfDate) continue;
    const typeValue = t.type?.value;
    if (typeValue === 'Accrual') {
      accrual += Number(t.interestPortion || 0);
    } else if (typeValue === 'Repayment' || typeValue === 'Recovery Repayment') {
      paid += Number(t.interestPortion || 0);
    }
  }
  return Math.max(accrual, paid);
}

// Range-scoped interest income: earnedInterestAsOf is a cumulative-since-disbursement
// figure, so the amount earned strictly within [from, to] is the difference between the
// cumulative totals at the two boundaries - not an independent sum over transactions dated
// inside the window, which would double-count/misattribute at boundaries relative to the
// lifetime figure. With from=null (or at/before disbursement), earnedInterestAsOf(from) is
// 0 (no transactions exist that early), so this correctly reduces to the plain lifetime
// figure - confirmed as a sanity check before shipping this.
function earnedInterestInRange(transactions, from, to, today) {
  const rangeTo = to || today;
  const upToTo = earnedInterestAsOf(transactions, rangeTo);
  const upToFrom = from ? earnedInterestAsOf(transactions, from) : 0;
  return upToTo - upToFrom;
}

async function getMifosSummary({ from, to }) {
  const response = await cbsApi.get('/v1/loans', { params: { limit: 1000 } });
  const loans = response.data?.pageItems || [];
  const details = await Promise.all(loans.map(async (loan) => {
    const result = await cbsApi.get(`/v1/loans/${loan.id}?associations=transactions`);
    return result.data;
  }));
  const today = new Date();
  const buckets = {
    current: { label: 'Current', count: 0, principalDisbursed: 0, principalOutstanding: 0, interestOutstanding: 0, totalOutstanding: 0, totalCollected: 0 },
    days_1_30: { label: '1-30 days', count: 0, principalDisbursed: 0, principalOutstanding: 0, interestOutstanding: 0, totalOutstanding: 0, totalCollected: 0 },
    days_31_60: { label: '31-60 days', count: 0, principalDisbursed: 0, principalOutstanding: 0, interestOutstanding: 0, totalOutstanding: 0, totalCollected: 0 },
    days_61_90: { label: '61-90 days', count: 0, principalDisbursed: 0, principalOutstanding: 0, interestOutstanding: 0, totalOutstanding: 0, totalCollected: 0 },
    days_90_plus: { label: '90+ days', count: 0, principalDisbursed: 0, principalOutstanding: 0, interestOutstanding: 0, totalOutstanding: 0, totalCollected: 0 }
  };
  const activeStatuses = new Set(['Active', 'Overpaid']);
  const activeBorrowers = new Set(details.filter((loan) => activeStatuses.has(loan.status?.value)).map((loan) => loan.clientId));
  let totalOutstandingPortfolio = 0;
  let principalPaidTotal = 0;
  let interestPaidTotal = 0;
  let interestIncome = 0;
  let feeIncome = 0;
  let totalExpected = 0;
  let totalCollected = 0;
  let nplAmount = 0;
  let disbursedCount = 0;
  let disbursedAmount = 0;

  for (const loan of details) {
    const summary = loan.summary || {};
    const timeline = loan.timeline || {};
    const disbursedAt = mifosDate(timeline.actualDisbursementDate);
    const principalDisbursed = Number(summary.principalDisbursed || 0);
    const principalOutstanding = Number(summary.principalOutstanding || 0);
    const interestOutstanding = Number(summary.interestOutstanding || 0);
    const totalOutstanding = Number(summary.totalOutstanding || 0);
    const expectedRepayment = Number(summary.totalExpectedRepayment || 0);
    const repayment = Number(summary.totalRepayment || 0);
    totalOutstandingPortfolio += principalOutstanding;
    principalPaidTotal += Number(summary.principalPaid || 0);
    interestPaidTotal += Number(summary.interestPaid || 0);
    interestIncome += earnedInterestInRange(loan.transactions, from, to, today);
    totalExpected += expectedRepayment;
    totalCollected += repayment;
    if (inDateRange(disbursedAt, from, to)) {
      disbursedCount += 1;
      disbursedAmount += principalDisbursed;
      // Fee charges are one-time, disbursement-time events (confirmed - feeChargesCharged
      // already equals feeChargesPaid exactly on every loan checked with real charges), not
      // amortized like interest, so there's no "future fee" to guard against the way
      // interest needed - only date-range scoping, via the same disbursedAt window Loans
      // Disbursed already uses.
      feeIncome += Number(summary.feeChargesCharged || 0);
    }

    const overdueSince = mifosDate(summary.overdueSinceDate);
    const overdueDays = overdueSince ? Math.max(0, Math.floor((today - overdueSince) / 86400000)) : 0;
    const bucketKey = !overdueSince || overdueDays === 0 ? 'current'
      : overdueDays <= 30 ? 'days_1_30'
        : overdueDays <= 60 ? 'days_31_60'
          : overdueDays <= 90 ? 'days_61_90' : 'days_90_plus';
    if (activeStatuses.has(loan.status?.value)) {
      const bucket = buckets[bucketKey];
      bucket.count += 1;
      bucket.principalDisbursed += principalDisbursed;
      bucket.principalOutstanding += principalOutstanding;
      bucket.interestOutstanding += interestOutstanding;
      bucket.totalOutstanding += totalOutstanding;
      bucket.totalCollected += repayment;
    }
    if (bucketKey === 'days_90_plus') nplAmount += totalOutstanding;
  }

  return {
    totalOutstandingPortfolio,
    par30Percent: totalOutstandingPortfolio ? Number(((nplAmount / totalOutstandingPortfolio) * 100).toFixed(2)) : 0,
    nplPercent: totalOutstandingPortfolio ? Number(((nplAmount / totalOutstandingPortfolio) * 100).toFixed(2)) : 0,
    nplAmount,
    loansDisbursedThisMonthCount: disbursedCount,
    loansDisbursedThisMonthAmount: disbursedAmount,
    principalPaidTotal,
    interestIncomeThisMonth: interestIncome,
    interestPaidTotal,
    feeIncomeThisMonth: feeIncome,
    activeBorrowers: activeBorrowers.size,
    collectionRatePercent: totalExpected ? Number(((totalCollected / totalExpected) * 100).toFixed(2)) : 0,
    delinquencyBuckets: buckets,
    source: 'MIFOS'
  };
}

// SECURITY FIX: a caller-supplied ?tenantId= used to be honored unconditionally,
// for ANY authenticated dashboard:read caller — which every tenant role has by
// default. That meant any tenant user could view another tenant's real
// Dashboard data just by supplying a different tenantId, with no ownership or
// permission check at all. Now a caller-supplied tenantId is only honored for
// callers with explicit cross-tenant read authority (platform admin, or the
// tenants:read_all permission). Every other caller is always scoped to their
// own req.tenant.tenantId (from their authenticated session), regardless of
// what they pass in the query string.
function resolveTenantFilter(req) {
  const ownTenantId = req.tenant?.tenantId || null;
  const hasCrossTenantReadAccess = req.authContext?.isSuperAdmin
    || req.user?.role === 'admin'
    || Boolean(req.authContext?.permissions?.includes('tenants:read_all'));

  if (req.query.tenantId && hasCrossTenantReadAccess) {
    return { tenantId: req.query.tenantId };
  }
  if (ownTenantId) {
    return { tenantId: ownTenantId };
  }
  if (req.authContext?.isSuperAdmin) {
    return {};
  }
  return null;
}

class DashboardController {
  static async overview(req, res) {
    try {
      const tenantFilter = resolveTenantFilter(req);
      if (tenantFilter === null) {
        return res.status(403).json({
          success: false,
          message: 'Tenant context required for dashboard.'
        });
      }

      const db = mongoose.connection.db;
      const loanMatch = { ...tenantFilter };

      const MessageLog = require('../models/MessageLog');
      const from = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
      const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;
      const messageMatch = {
        status: { $in: ['pending', 'failed'] },
        ...tenantFilter,
      };

      // ESS Summary (pendingEmployerApproval/activeLoans/etc.) is meant to respond to the
      // selected date range, unlike loansByStatus below (which feeds the "Loans by Status"
      // pie chart and successRate - lifetime, unscoped, not part of this fix) - so it needs
      // its own createdAt-filtered aggregate rather than reusing loansByStatus's result.
      const essLoanMatch = {
        ...loanMatch,
        ...((from || to) ? { createdAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) } } : {})
      };

      const [totalLoans, loansByStatus, essStatusInRange, tenantUserCount, dailyApplications, pendingMessages, mifosSummary] = await Promise.all([
        db.collection('loanmappings').countDocuments(loanMatch),
        db.collection('loanmappings').aggregate([
          { $match: loanMatch },
          { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$requestedAmount' } } }
        ]).toArray(),
        db.collection('loanmappings').aggregate([
          { $match: essLoanMatch },
          { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$requestedAmount' } } }
        ]).toArray(),
        tenantFilter.tenantId
          ? TenantUser.countDocuments({ tenantId: tenantFilter.tenantId, isActive: true })
          : TenantUser.countDocuments({ isActive: true }),
        (() => {
          // Falls back to a 7-day lookback only when no range is selected at all (matches
          // this endpoint's pre-existing default behavior for callers that don't pass
          // from/to) - otherwise genuinely uses the selected range instead of always
          // hardcoding 7 days regardless of what was picked.
          const defaultFrom = new Date();
          defaultFrom.setDate(defaultFrom.getDate() - 7);
          return db.collection('loanmappings').aggregate([
            { $match: { ...loanMatch, createdAt: { $gte: from || defaultFrom, ...(to && { $lte: to }) } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 },
                totalAmount: { $sum: '$requestedAmount' }
              }
            },
            { $sort: { _id: 1 } }
          ]).toArray();
        })(),
        MessageLog.countDocuments(messageMatch).catch(() => 0),
        getMifosSummary({ from, to }).catch((error) => {
          logger.warn('MIFOS dashboard summary unavailable', { error: error.message });
          return null;
        }),
      ]);

      const successful = loansByStatus.find((s) => s._id === 'DISBURSED' || s._id === 'OFFER_SUBMITTED')?.count || 0;
      const failed = loansByStatus.find((s) => s._id === 'FAILED')?.count || 0;
      const successRate = totalLoans > 0
        ? parseFloat((((successful) / totalLoans) * 100).toFixed(1))
        : 0;

      res.json({
        success: true,
        data: {
          overview: {
            totalLoans,
            totalUsers: tenantUserCount,
            successRate,
            pendingMessages
          },
          loanStatistics: {
            byStatus: loansByStatus.map((item) => ({
              status: item._id || 'Unknown',
              count: item.count,
              totalAmount: item.totalAmount || 0
            })),
            essSummary: buildEssLoanSummary(essStatusInRange),
            dailyApplications: dailyApplications.map((item) => ({
              date: item._id,
              applications: item.count,
              totalAmount: item.totalAmount || 0
            }))
          },
          miraCoreSummary: mifosSummary,
          tenantId: tenantFilter.tenantId || null
        }
      });
    } catch (error) {
      logger.error('Dashboard overview error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async activity(req, res) {
    try {
      const tenantFilter = resolveTenantFilter(req);
      if (tenantFilter === null) {
        return res.status(403).json({
          success: false,
          message: 'Tenant context required for dashboard activity.'
        });
      }

      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
      const skip = (page - 1) * limit;

      const filter = { ...tenantFilter };
      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .populate('userId', 'username fullName')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        }
      });
    } catch (error) {
      logger.error('Dashboard activity error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async messages(req, res) {
    try {
      const MessageLog = require('../models/MessageLog');
      const tenantFilter = resolveTenantFilter(req);
      const filter = { status: { $in: ['pending', 'failed'] } };
      if (tenantFilter?.tenantId) {
        filter.tenantId = tenantFilter.tenantId;
      }

      let count = 0;
      try {
        count = await MessageLog.countDocuments(filter);
      } catch {
        count = 0;
      }

      res.json({
        success: true,
        data: { pendingCount: count }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Drill-down rows behind a summary card. Currently only 'interest-income' is implemented -
  // this route existed on the frontend (DashboardDetail.js has a full column config and calls
  // this exact path) with nothing behind it on the backend at all, so every metric 404'd and
  // the detail page always rendered empty.
  //
  // interest-income mirrors overview()'s miraCoreSummary.interestIncomeThisMonth exactly: both
  // use earnedInterestInRange() (max of daily-accrual and actually-paid interest, per loan
  // transaction history - NOT summary.interestCharged, the full life-of-loan scheduled total
  // including every future installment). Now genuinely scoped by from/to (previously this
  // list - like the summary card - was lifetime-to-date regardless of the label; that's fixed
  // as part of the same change, see earnedInterestInRange's own comment).
  static async detail(req, res) {
    try {
      const tenantFilter = resolveTenantFilter(req);
      if (tenantFilter === null) {
        return res.status(403).json({
          success: false,
          message: 'Tenant context required for dashboard detail.'
        });
      }

      const { metric } = req.params;
      const from = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
      const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;

      if (metric === 'interest-income') {
        const response = await cbsApi.get('/v1/loans', { params: { limit: 1000 } });
        const loans = response.data?.pageItems || [];
        const today = new Date();
        const details = await Promise.all(loans.map(async (loan) => {
          const result = await cbsApi.get(`/v1/loans/${loan.id}?associations=transactions`);
          return result.data;
        }));

        const rows = details
          .filter((loan) => mifosDate(loan.timeline?.actualDisbursementDate))
          .map((loan) => ({
            date: mifosDate(loan.timeline?.actualDisbursementDate)?.toISOString().slice(0, 10) || null,
            loanAccountNo: loan.accountNo,
            clientName: loan.clientName,
            amount: earnedInterestInRange(loan.transactions, from, to, today)
          }))
          .filter((row) => row.amount > 0)
          .sort((a, b) => b.amount - a.amount);

        return res.json({ success: true, data: { rows } });
      }

      return res.json({ success: true, data: { rows: [] } });
    } catch (error) {
      logger.error('Dashboard detail error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = DashboardController;
