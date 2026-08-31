const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const TenantUser = require('../models/TenantUser');
const logger = require('../utils/logger');
const { buildEssLoanSummary } = require('../utils/essLoanSummary');

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
      const messageMatch = {
        status: { $in: ['pending', 'failed'] },
        ...tenantFilter,
      };

      const [totalLoans, loansByStatus, tenantUserCount, dailyApplications, pendingMessages] = await Promise.all([
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
