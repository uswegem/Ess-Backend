const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const TenantUser = require('../models/TenantUser');
const logger = require('../utils/logger');
const { buildEssLoanSummary } = require('../utils/essLoanSummary');

function resolveTenantFilter(req) {
  if (req.query.tenantId) {
    return { tenantId: req.query.tenantId };
  }
  if (req.tenant?.tenantId) {
    return { tenantId: req.tenant.tenantId };
  }
  if (req.authContext?.isSuperAdmin && req.query.allTenants === 'true') {
    return {};
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
