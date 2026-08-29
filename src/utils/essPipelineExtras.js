const LoanMapping = require('../models/LoanMapping');
const MessageLog = require('../models/MessageLog');

// ESS Summary "pipeline health" metrics for the Dashboard - genuinely Mongo/message-driven,
// as opposed to MiraCore Summary's Fineract-sourced loan-book metrics. Complements the
// existing per-status buckets in essLoanSummary.js with volume/throughput/reliability
// figures across the ESS message flow itself.

function defaultThisMonthRange() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: monthStart, to: now };
}

/**
 * @param {Object} loanMatch - tenant-scoped Mongo filter, same shape dashboardController
 *   already builds for LoanMapping queries (e.g. { tenantId } or {} for cross-tenant).
 * @param {Object} messageMatch - tenant-scoped Mongo filter for MessageLog (e.g. { tenantId }).
 * @param {{from: Date, to: Date}|null} range - defaults to the current calendar month
 */
async function buildEssPipelineExtras(loanMatch = {}, messageMatch = {}, range = null) {
  const { from, to } = range || defaultThisMonthRange();

  const [applicationsThisMonth, messagesThisMonth, disbursedTurnaroundAgg] = await Promise.all([
    LoanMapping.countDocuments({ ...loanMatch, createdAt: { $gte: from, $lte: to } }),

    MessageLog.aggregate([
      { $match: { ...messageMatch, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).catch(() => []),

    // Avg turnaround = disbursedAt - createdAt, in days, over records disbursed in range.
    LoanMapping.aggregate([
      {
        $match: {
          ...loanMatch,
          status: 'DISBURSED',
          disbursedAt: { $gte: from, $lte: to },
          createdAt: { $exists: true }
        }
      },
      {
        $project: {
          turnaroundDays: {
            $divide: [{ $subtract: ['$disbursedAt', '$createdAt'] }, 1000 * 60 * 60 * 24]
          }
        }
      },
      { $group: { _id: null, avgTurnaroundDays: { $avg: '$turnaroundDays' }, count: { $sum: 1 } } }
    ]).catch(() => [])
  ]);

  const messageCountByStatus = messagesThisMonth.reduce((acc, item) => {
    acc[item._id || 'unknown'] = item.count;
    return acc;
  }, {});
  const messageVolumeThisMonth = Object.values(messageCountByStatus).reduce((sum, c) => sum + c, 0);
  const successfulMessages = (messageCountByStatus.sent || 0) + (messageCountByStatus.resent || 0);
  const failedMessages = messageCountByStatus.failed || 0;
  const messageSuccessRatePercent = (successfulMessages + failedMessages) > 0
    ? parseFloat(((successfulMessages / (successfulMessages + failedMessages)) * 100).toFixed(1))
    : 0;

  const turnaround = disbursedTurnaroundAgg[0];

  return {
    applications_this_month: applicationsThisMonth,
    message_volume_this_month: messageVolumeThisMonth,
    message_success_rate_percent: messageSuccessRatePercent,
    avg_turnaround_days: turnaround?.avgTurnaroundDays != null
      ? parseFloat(turnaround.avgTurnaroundDays.toFixed(1))
      : null // null (not 0) when no loans disbursed in range - distinguishes "no data" from "instant turnaround"
  };
}

module.exports = { buildEssPipelineExtras };
