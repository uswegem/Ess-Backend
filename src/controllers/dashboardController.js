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

async function getMifosSummary({ from, to }) {
  const response = await cbsApi.get('/v1/loans', { params: { limit: 1000 } });
  const loans = response.data?.pageItems || [];
  const details = await Promise.all(loans.map(async (loan) => {
    const result = await cbsApi.get(`/v1/loans/${loan.id}`);
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
    interestIncome += Number(summary.interestCharged || 0);
    feeIncome += Number(summary.feeChargesCharged || 0);
    totalExpected += expectedRepayment;
    totalCollected += repayment;
    if (inDateRange(disbursedAt, from, to)) {
      disbursedCount += 1;
      disbursedAmount += principalDisbursed;
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

      const [totalLoans, loansByStatus, tenantUserCount, dailyApplications, pendingMessages, mifosSummary] = await Promise.all([
        db.collection('loanmappings').countDocuments(loanMatch),
        db.collection('loanmappings').aggregate([
          { $match: loanMatch },
          { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$requestedAmount' } } }
        ]).toArray(),
        tenantFilter.tenantId
          ? TenantUser.countDocuments({ tenantId: tenantFilter.tenantId, isActive: true })
          : TenantUser.countDocuments({ isActive: true }),
        (() => {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return db.collection('loanmappings').aggregate([
            { $match: { ...loanMatch, createdAt: { $gte: sevenDaysAgo } } },
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
            essSummary: buildEssLoanSummary(loansByStatus),
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
}

module.exports = DashboardController;
