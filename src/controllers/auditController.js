const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

class AuditController {
  static async getAuditLogs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const { action, userId, startDate, endDate, status } = req.query;

      let filter = {};

      if (action) filter.action = action;
      if (userId) filter.userId = userId;
      if (status) filter.status = status;

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const logs = await AuditLog.find(filter)
        .populate('userId', 'username fullName role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AuditLog.countDocuments(filter);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching audit logs.'
      });
    }
  }

  static async getAuditStats(req, res) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stats = await AuditLog.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            success: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const totalLogs = await AuditLog.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });

      res.json({
        success: true,
        data: {
          stats,
          totalLogs,
          period: '30 days'
        }
      });

    } catch (error) {
      logger.error('Get audit stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching audit statistics.'
      });
    }
  }
}

module.exports = AuditController;