const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const TenantUser = require('../models/TenantUser');
const logger = require('../utils/logger');
const { buildEssLoanSummary } = require('../utils/essLoanSummary');
const { buildEssPipelineExtras } = require('../utils/essPipelineExtras');
const { getFineractPortfolioSummary } = require('../services/fineractPortfolioSummary');
const { getFineractIncomeSummary } = require('../services/fineractIncomeSummary');
const { getDashboardDetail } = require('../services/dashboardDetailService');
const { getMetricColumns, getMetricTitle, formatRowsForPdf } = require('../utils/dashboardDetailColumns');
const pdfGeneratorService = require('../services/pdfGeneratorService');

// Parses ?from/?to into a {from, to} Date range, or null when neither is given (callers then
// apply their own metric-appropriate default - e.g. "this month" for time-scoped MiraCore
// figures). Defaulting `from` to UTC-midnight of the 1st of `to`'s month (not
// `new Date(y, m, 1)`) keeps this consistent with fineractLoanRows.js's UTC-midnight
// actualDisbursementDate convention - see that file's comment for why a local-timezone
// construction would silently exclude loans disbursed on this server (EAT, UTC+3).
function parseRangeFromQuery(req) {
  if (!req.query.from && !req.query.to) return null;

  // A caller-supplied ?to as a plain date string (e.g. "2026-08-13", what the frontend's
  // "Today"/"Custom" presets send) must mean "through the end of that day", not the exact
  // UTC-midnight instant - otherwise `to` on its own is a zero-width boundary and a
  // same-day range (from === to, e.g. "Today") would match nothing at all except records
  // timestamped at exactly midnight. Only push to end-of-day for a genuine date-only string;
  // the no-?to fallback (`new Date()`, a real "right now" instant) already means "up to now".
  let to;
  if (req.query.to) {
    to = new Date(req.query.to);
    if (!Number.isNaN(to.getTime())) {
      to.setUTCHours(23, 59, 59, 999);
    }
  } else {
    to = new Date();
  }

  const from = req.query.from
    ? new Date(req.query.from)
    : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    const err = new Error('Invalid from/to date');
    err.statusCode = 400;
    throw err;
  }
  return { from, to };
}

// SECURITY FIX (found during Track 3's cross-tenant visibility work): a caller-supplied
// ?tenantId= used to be honored unconditionally, for ANY authenticated dashboard:read
// caller - which every tenant role has by default. That meant any tenant user could view
// another tenant's real Dashboard data (overview, activity, messages, detail, export) just
// by supplying a different tenantId, with no ownership or permission check at all. Now a
// caller-supplied tenantId is only honored for callers with explicit cross-tenant read
// authority (platform admin, or the tenants:read_all permission - see
// tenantController.js's canReadAllTenants, same grant used for the Tenants list). Every
// other caller is always scoped to their own req.tenant.tenantId (from their authenticated
// session), regardless of what they pass in the query string.
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

      const range = parseRangeFromQuery(req);

      const db = mongoose.connection.db;
      const loanMatch = { ...tenantFilter };

      const MessageLog = require('../models/MessageLog');
      const messageMatch = {
        status: { $in: ['pending', 'failed'] },
        ...tenantFilter,
      };

      const [portfolioSummary, incomeSummary, loansByStatus, tenantUserCount, dailyApplications, pendingMessages, essPipelineExtras] = await Promise.all([
        getFineractPortfolioSummary(tenantFilter.tenantId || null, range),
        getFineractIncomeSummary(tenantFilter.tenantId || null, range),
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
        buildEssPipelineExtras(loanMatch, messageMatch, range),
      ]);

      const { total_loans: totalLoans, active_loans: activeLoans } = portfolioSummary;
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
            activeLoans,
            totalUsers: tenantUserCount,
            successRate,
            pendingMessages
          },
          // MiraCore Summary - Fineract-sourced loan-book health. See
          // fineractPortfolioSummary.js / fineractIncomeSummary.js for exact
          // endpoint/calculation per metric and the 2-minute cache they share.
          miraCoreSummary: {
            totalOutstandingPortfolio: portfolioSummary.total_outstanding_portfolio,
            // par30Percent kept in the response (cheap, still backs the par30 detail/export
            // route) but no longer rendered as its own card - replaced on the Dashboard by NPL.
            par30Percent: portfolioSummary.par30_percent,
            nplPercent: portfolioSummary.npl_percent,
            nplAmount: portfolioSummary.npl_amount,
            loansDisbursedThisMonthCount: portfolioSummary.loans_disbursed_this_month_count,
            loansDisbursedThisMonthAmount: portfolioSummary.loans_disbursed_this_month_amount,
            activeBorrowers: portfolioSummary.active_borrowers,
            principalPaidTotal: portfolioSummary.principal_paid_total,
            interestIncomeThisMonth: incomeSummary.interest_income_this_month,
            interestPaidTotal: portfolioSummary.interest_paid_total,
            feeIncomeThisMonth: incomeSummary.fee_income_this_month,
            collectionRatePercent: portfolioSummary.collection_rate_percent,
            delinquencyBuckets: portfolioSummary.delinquency_buckets
          },
          // ESS Summary - Mongo/message-driven application-pipeline health. Sourced from
          // LoanMapping + MessageLog only; distinct from miraCoreSummary's Fineract data.
          essPipelineSummary: {
            stages: buildEssLoanSummary(loansByStatus),
            applicationsThisMonth: essPipelineExtras.applications_this_month,
            messageVolumeThisMonth: essPipelineExtras.message_volume_this_month,
            messageSuccessRatePercent: essPipelineExtras.message_success_rate_percent,
            avgTurnaroundDays: essPipelineExtras.avg_turnaround_days
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
          tenantId: tenantFilter.tenantId || null,
          // Echoes the actually-applied range (including the "this month" default when the
          // caller sent neither ?from nor ?to) so the frontend can label time-scoped cards
          // accurately without re-deriving the default logic itself.
          range: {
            from: (range?.from || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))).toISOString(),
            to: (range?.to || new Date()).toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Dashboard overview error:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
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

  // Row-level data behind a MiraCore Summary card, for its click-through detail page. See
  // dashboardDetailService.js for the metric list and which ones respect ?from/?to vs. always
  // reflecting current state (point-in-time metrics: portfolio, par30, borrowers,
  // delinquency-*).
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
      const range = parseRangeFromQuery(req);

      const rows = await getDashboardDetail(metric, tenantFilter.tenantId || null, range);
      res.json({ success: true, data: { metric, rows } });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      logger.error('Dashboard detail error:', error);
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // "Export PDF" on a detail page. CSV export is client-side (DashboardDetail.js builds it
  // directly from the DataGrid's own rows/columns - no backend round-trip needed), but PDF
  // generation reuses this app's existing pdf-lib-based service (pdfGeneratorService.js),
  // which only runs server-side.
  static async exportPdf(req, res) {
    try {
      const tenantFilter = resolveTenantFilter(req);
      if (tenantFilter === null) {
        return res.status(403).json({
          success: false,
          message: 'Tenant context required for dashboard export.'
        });
      }

      const { metric } = req.params;
      const range = parseRangeFromQuery(req);

      const rawRows = await getDashboardDetail(metric, tenantFilter.tenantId || null, range);
      const rows = formatRowsForPdf(metric, rawRows);
      const columns = getMetricColumns(metric);
      const title = getMetricTitle(metric);
      const subtitle = range
        ? `${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)}`
        : undefined;

      const pdfBuffer = await pdfGeneratorService.generateTablePdf(title, subtitle, columns, rows);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${metric}-${Date.now()}.pdf"`
      });
      res.send(pdfBuffer);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      logger.error('Dashboard export PDF error:', error);
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }
}

module.exports = DashboardController;
