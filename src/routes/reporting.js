const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const LoanMapping = require('../models/LoanMapping');
const MessageLog = require('../models/MessageLog');
const PossibleLoanCharges = require('../models/PossibleLoanCharges');
const LoanMappingService = require('../services/loanMappingService');
const { authMiddleware, permissionMiddleware, isPlatformAdminUser } = require('../middleware/authMiddleware');

// Internal, read-only reporting endpoints backing the Grafana "Live" dashboard
// (ess-loan-lifecycle-live.json, via the Infinity datasource). Each endpoint reproduces
// one panel-pair (bar chart summary + recent-rows table) from the historical Mongo-plugin
// dashboard, using the exact same collection/field/aggregation logic already catalogued
// from that dashboard's JSON - no new query design, just an HTTP wrapper around it.
//
// Auth: authMiddleware (JWT or tenant-bound ApiKey) + permissionMiddleware('reporting:read').
//
// Tenant scoping: a tenant-bound ApiKey is always forced to its own tenant, even if a
// ?tenantId= param is passed for a different tenant (rejected, not silently ignored - see
// resolveScope below). Only callers with the 'reporting:all_tenants' permission (or a JWT
// user in PLATFORM_ADMIN_ROLES) may use ?tenantId= as an optional filter, or omit it for
// all-tenant visibility. This mirrors the existing ApiKey/tenantMiddleware scoping pattern
// used everywhere else in the app - no new auth mechanism, no schema changes.

router.use(authMiddleware);
router.use(permissionMiddleware('reporting:read'));

function hasAllTenantsAccess(req) {
  return (req.authContext?.permissions || []).includes('reporting:all_tenants')
    || isPlatformAdminUser(req.user);
}

// Resolves the tenantId to scope this request's queries by, or null for "all tenants"
// (only ever returned for callers with all-tenant access). Throws a 403-flagged error if
// a tenant-bound caller asks for a tenantId other than their own.
function resolveScope(req) {
  const requestedTenantId = req.query.tenantId ? String(req.query.tenantId).trim() : null;

  if (hasAllTenantsAccess(req)) {
    return requestedTenantId || null;
  }

  const ownTenantId = req.tenant?.tenantId || null;
  if (requestedTenantId && ownTenantId && requestedTenantId !== ownTenantId) {
    const err = new Error(`Not authorized to view tenant "${requestedTenantId}"'s data`);
    err.statusCode = 403;
    throw err;
  }
  return ownTenantId;
}

function parseRange(req) {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return { from, to };
}

function scopedMatch(baseMatch, tenantId) {
  return tenantId ? { ...baseMatch, tenantId } : baseMatch;
}

async function handleReportingQuery(req, res, { buildSummaryPipeline, buildRowsPipeline, Model }) {
  try {
    const tenantId = resolveScope(req);
    const { from, to } = parseRange(req);

    const [summaryResult, rows] = await Promise.all([
      Model.aggregate(buildSummaryPipeline(tenantId, from, to)),
      Model.aggregate(buildRowsPipeline(tenantId, from, to))
    ]);

    res.json({
      success: true,
      rows,
      summary: summaryResult[0] || null
    });
  } catch (error) {
    logger.error(`Reporting endpoint error (${req.path}):`, { error: error.message });
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// 1. Possible Loan Charges (possibleloancharges, panels 2/3)
router.get('/possible-loan-charges', (req, res) => handleReportingQuery(req, res, {
  Model: PossibleLoanCharges,
  buildSummaryPipeline: (tenantId, from, to) => [
    { $match: scopedMatch({ createdAt: { $gt: from, $lt: to } }, tenantId) },
    { $group: {
      _id: null,
      pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
      completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } }
    } },
    { $project: {
      _id: 0,
      category: { $literal: 'LOAN_CHARGES_REQUEST' },
      pending: 1, completed: 1, failed: 1
    } }
  ],
  buildRowsPipeline: (tenantId, from, to) => [
    { $match: scopedMatch({ createdAt: { $gt: from, $lt: to } }, tenantId) },
    { $sort: { createdAt: -1 } },
    { $limit: 50 },
    { $project: {
      _id: 0,
      trace_id: { $toString: '$_id' },
      time: '$createdAt',
      message_type: { $literal: 'LOAN_CHARGES_REQUEST' },
      id_number: '$idNumber',
      id_number_type: '$idNumberType',
      application_number: '$applicationNumber',
      product_code: '$productCode',
      product_name: '$productName',
      affordability_type: '$affordabilityType',
      requested_amount: '$requestedAmount',
      requested_tenure: '$requestedTenure',
      deductible_amount: '$deductibleAmount',
      desired_deductible_amount: '$desiredDeductibleAmount',
      eligible_amount: '$eligibleAmount',
      net_loan_amount: '$netLoanAmount',
      total_amount_to_pay: '$totalAmountToPay',
      monthly_return_amount: '$monthlyReturnAmount',
      total_processing_fees: '$totalProcessingFees',
      total_insurance: '$totalInsurance',
      total_interest_rate_amount: '$totalInterestRateAmount',
      other_charges: '$otherCharges',
      status: '$status',
      error_message: '$errorMessage',
      created_at: '$createdAt',
      updated_at: '$updatedAt',
      tenant_id: '$tenantId'
    } }
  ]
}));

// 2. Loan Request (loanmappings, panels 11/12)
const LOAN_REQUEST_TYPES = ['LOAN_OFFER_REQUEST', 'TOP_UP_OFFER_REQUEST', 'LOAN_RESTRUCTURE_REQUEST', 'LOAN_TAKEOVER_OFFER_REQUEST'];
router.get('/loan-request', (req, res) => handleReportingQuery(req, res, {
  Model: LoanMapping,
  buildSummaryPipeline: (tenantId, from, to) => [
    { $addFields: { _ts: { $toDate: { $ifNull: ['$metadata.offerReceivedAt', '$createdAt'] } } } },
    { $match: scopedMatch({ _ts: { $gt: from, $lt: to }, originalMessageType: { $in: LOAN_REQUEST_TYPES } }, tenantId) },
    { $group: {
      _id: '$originalMessageType',
      duplicate: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
      received: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'FAILED'] }, { $ne: ['$status', 'CANCELLED'] }] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } }
    } },
    { $project: { _id: 0, message_type: '$_id', duplicate: 1, received: 1, failed: 1 } },
    { $sort: { message_type: 1 } }
  ],
  buildRowsPipeline: (tenantId, from, to) => [
    { $addFields: { _ts: { $toDate: { $ifNull: ['$metadata.offerReceivedAt', '$createdAt'] } } } },
    { $match: scopedMatch({ _ts: { $gt: from, $lt: to }, originalMessageType: { $in: LOAN_REQUEST_TYPES } }, tenantId) },
    { $sort: { _ts: -1 } },
    { $limit: 50 },
    { $project: {
      _id: 0,
      trace_id: { $toString: '$_id' },
      time: '$_ts',
      request_type: '$originalMessageType',
      utumishi_id: '$essApplicationNumber',
      check_number: '$essCheckNumber',
      first_name: '$metadata.clientData.firstName',
      middle_name: '$metadata.clientData.middleName',
      last_name: '$metadata.clientData.lastName',
      sex: '$metadata.clientData.sex',
      product_code: '$productCode',
      requested_amount: '$requestedAmount',
      tenure: '$tenure',
      duplicate_of_trace: '$duplicateOfTrace',
      created_at: '$createdAt',
      updated_at: '$updatedAt',
      tenant_id: '$tenantId'
    } }
  ]
}));

// 3. Loan Offer / initial approval (loanmappings, panels 21/22)
router.get('/loan-offer', (req, res) => handleReportingQuery(req, res, {
  Model: LoanMapping,
  buildSummaryPipeline: (tenantId, from, to) => [
    { $match: scopedMatch({ initialOfferSentAt: { $gt: from, $lt: to }, originalMessageType: { $exists: true } }, tenantId) },
    { $group: {
      _id: null,
      approved: { $sum: { $cond: [{ $not: [{ $in: ['$status', ['REJECTED', 'FAILED', 'INITIAL_OFFER', 'OFFER_SUBMITTED', 'INITIAL_APPROVAL_SENT', 'CANCELLED']] }] }, 1, 0] } },
      rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
      pending: { $sum: { $cond: [{ $in: ['$status', ['INITIAL_OFFER', 'OFFER_SUBMITTED', 'INITIAL_APPROVAL_SENT']] }, 1, 0] } }
    } },
    { $project: { _id: 0, category: { $literal: 'LOAN_INITIAL_APPROVAL_NOTIFICATION' }, approved: 1, rejected: 1, failed: 1, pending: 1 } }
  ],
  buildRowsPipeline: (tenantId, from, to) => [
    { $match: scopedMatch({ initialOfferSentAt: { $gt: from, $lt: to }, originalMessageType: { $exists: true } }, tenantId) },
    { $sort: { initialOfferSentAt: -1 } },
    { $limit: 50 },
    { $project: {
      _id: 0,
      trace_id: { $toString: '$_id' },
      time: '$initialOfferSentAt',
      application_number: '$essApplicationNumber',
      loan_number: '$essLoanNumberAlias',
      fsp_reference_num: '$fspReferenceNumber',
      product_code: '$productCode',
      requested_amount: '$requestedAmount',
      reason: '$status',
      rejected_by: '$rejectedBy',
      rejection_reason: '$rejectionReason',
      duplicate_of_trace: '$duplicateOfTrace',
      created_at: '$createdAt',
      updated_at: '$updatedAt',
      tenant_id: '$tenantId'
    } }
  ]
}));

// 4. HR Approval / final approval (loanmappings, panels 31/32)
router.get('/hr-approval', (req, res) => handleReportingQuery(req, res, {
  Model: LoanMapping,
  buildSummaryPipeline: (tenantId, from, to) => [
    { $match: scopedMatch({ finalApprovalReceivedAt: { $gt: from, $lt: to } }, tenantId) },
    { $group: {
      _id: null,
      approved: { $sum: { $cond: [{ $eq: ['$metadata.finalApprovalDetails.approval', 'APPROVED'] }, 1, 0] } },
      rejected: { $sum: { $cond: [{ $and: [{ $ne: ['$metadata.finalApprovalDetails.approval', 'APPROVED'] }, { $ne: ['$status', 'FAILED'] }] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } }
    } },
    { $project: { _id: 0, category: { $literal: 'LOAN_FINAL_APPROVAL_NOTIFICATION' }, approved: 1, rejected: 1, failed: 1 } }
  ],
  buildRowsPipeline: (tenantId, from, to) => [
    { $match: scopedMatch({ finalApprovalReceivedAt: { $gt: from, $lt: to } }, tenantId) },
    { $sort: { finalApprovalReceivedAt: -1 } },
    { $limit: 50 },
    { $project: {
      _id: 0,
      trace_id: { $toString: '$_id' },
      time: '$finalApprovalReceivedAt',
      application_number: '$essApplicationNumber',
      fsp_reference_num: '$fspReferenceNumber',
      mifos_client_id: '$mifosClientId',
      mifos_loan_id: '$mifosLoanId',
      reason: '$metadata.finalApprovalDetails.reason',
      rejected_by: '$rejectedBy',
      rejection_reason: '$rejectionReason',
      cancelled_by: '$cancelledBy',
      cancellation_reason: '$cancellationReason',
      duplicate_of_trace: '$duplicateOfTrace',
      created_at: '$createdAt',
      updated_at: '$updatedAt',
      tenant_id: '$tenantId'
    } }
  ]
}));

// 5. Disbursement (loanmappings, panels 41/42)
router.get('/disbursement', (req, res) => handleReportingQuery(req, res, {
  Model: LoanMapping,
  buildSummaryPipeline: (tenantId, from, to) => [
    { $addFields: {
      _ts: { $toDate: { $ifNull: ['$disbursementFailureNotificationSentAt', '$disbursedAt'] } },
      _messageType: { $switch: {
        branches: [
          { case: { $in: ['$status', ['FAILED', 'DISBURSEMENT_FAILURE_NOTIFICATION_SENT']] }, then: 'DISBURSEMENT_FAILURE' },
          { case: { $eq: ['$originalMessageType', 'LOAN_TAKEOVER_OFFER_REQUEST'] }, then: 'TAKEOVER_DISBURSEMENT' }
        ],
        default: 'LOAN_DISBURSEMENT'
      } }
    } },
    { $match: scopedMatch({ _ts: { $gt: from, $lt: to }, status: { $in: ['DISBURSED', 'COMPLETED', 'FAILED', 'DISBURSEMENT_FAILURE_NOTIFICATION_SENT', 'CLIENT_CREATED', 'LOAN_CREATED'] } }, tenantId) },
    { $group: {
      _id: '$_messageType',
      disbursed: { $sum: { $cond: [{ $in: ['$status', ['DISBURSED', 'COMPLETED']] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $in: ['$status', ['FAILED', 'DISBURSEMENT_FAILURE_NOTIFICATION_SENT']] }, 1, 0] } },
      pending: { $sum: { $cond: [{ $in: ['$status', ['CLIENT_CREATED', 'LOAN_CREATED']] }, 1, 0] } }
    } },
    { $project: { _id: 0, message_type: '$_id', disbursed: 1, failed: 1, pending: 1 } },
    { $sort: { message_type: 1 } }
  ],
  buildRowsPipeline: (tenantId, from, to) => [
    { $addFields: {
      _ts: { $toDate: { $ifNull: ['$disbursementFailureNotificationSentAt', '$disbursedAt'] } },
      _messageType: { $switch: {
        branches: [
          { case: { $in: ['$status', ['FAILED', 'DISBURSEMENT_FAILURE_NOTIFICATION_SENT']] }, then: 'LOAN_DISBURSEMENT_FAILURE_NOTIFICATION' },
          { case: { $eq: ['$originalMessageType', 'LOAN_TAKEOVER_OFFER_REQUEST'] }, then: 'TAKEOVER_DISBURSEMENT_NOTIFICATION' }
        ],
        default: 'LOAN_DISBURSEMENT_NOTIFICATION'
      } }
    } },
    { $match: scopedMatch({ _ts: { $gt: from, $lt: to }, status: { $in: ['DISBURSED', 'COMPLETED', 'FAILED', 'DISBURSEMENT_FAILURE_NOTIFICATION_SENT'] } }, tenantId) },
    { $sort: { _ts: -1 } },
    { $limit: 50 },
    { $project: {
      _id: 0,
      trace_id: { $toString: '$_id' },
      time: '$_ts',
      message_type: '$_messageType',
      application_number: '$essApplicationNumber',
      loan_number: '$essLoanNumberAlias',
      fsp_reference_num: '$fspReferenceNumber',
      mifos_client_id: '$mifosClientId',
      mifos_loan_id: '$mifosLoanId',
      mifos_loan_account_number: '$mifosLoanAccountNumber',
      product_code: '$productCode',
      amount: '$metadata.disbursementDetails.amount',
      status: '$status',
      client_created_at: '$clientCreatedAt',
      loan_created_at: '$loanCreatedAt',
      completed_at: '$completedAt',
      liquidation_requested_at: '$liquidationRequestedAt',
      duplicate_of_trace: '$duplicateOfTrace',
      created_at: '$createdAt',
      updated_at: '$updatedAt',
      tenant_id: '$tenantId'
    } }
  ]
}));

// 6. Loan Liquidation (messagelogs, panels 51/52)
router.get('/liquidation', (req, res) => handleReportingQuery(req, res, {
  Model: MessageLog,
  buildSummaryPipeline: (tenantId, from, to) => [
    { $addFields: { _ts: { $toDate: { $ifNull: ['$sentAt', '$createdAt'] } } } },
    { $match: scopedMatch({ _ts: { $gt: from, $lt: to }, messageType: 'LOAN_LIQUIDATION_NOTIFICATION' }, tenantId) },
    { $group: {
      _id: null,
      received: { $sum: { $cond: [{ $eq: ['$direction', 'incoming'] }, 1, 0] } },
      sent: { $sum: { $cond: [{ $eq: ['$direction', 'outgoing'] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
    } },
    { $project: { _id: 0, category: { $literal: 'LOAN_LIQUIDATION_NOTIFICATION' }, received: 1, sent: 1, failed: 1 } }
  ],
  buildRowsPipeline: (tenantId, from, to) => [
    { $addFields: { _ts: { $toDate: { $ifNull: ['$sentAt', '$createdAt'] } } } },
    { $match: scopedMatch({ _ts: { $gt: from, $lt: to }, messageType: 'LOAN_LIQUIDATION_NOTIFICATION' }, tenantId) },
    { $sort: { _ts: -1 } },
    { $limit: 50 },
    { $project: {
      _id: 0,
      trace_id: { $toString: '$_id' },
      time: '$_ts',
      message_type: '$messageType',
      direction: '$direction',
      application_number: '$applicationNumber',
      loan_number: '$loanNumber',
      fsp_reference_num: '$fspReferenceNumber',
      message_id: '$messageId',
      sender: '$sender',
      receiver: '$receiver',
      sent_by: '$sentBy',
      status: '$status',
      error_message: '$errorMessage',
      retry_count: '$retryCount',
      resent_at: '$resentAt',
      duplicate_of_trace: '$duplicateOfTrace',
      created_at: '$createdAt',
      updated_at: '$updatedAt',
      tenant_id: '$tenantId'
    } }
  ]
}));

module.exports = router;
