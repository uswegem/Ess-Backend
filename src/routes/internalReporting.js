const express = require('express');
const router = express.Router();
const MessageLog = require('../models/MessageLog');
const PossibleLoanCharges = require('../models/PossibleLoanCharges');
const LoanMapping = require('../models/LoanMapping');
const { authMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware, permissionMiddleware('reporting:read'));

function dateFilter(req) {
  const filter = { tenantId: req.tenant.tenantId };
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  return filter;
}

function sendRows(res, rows, summary) {
  return res.json({ success: true, summary, rows });
}

function messageRows(messages) {
  return messages.map((message) => ({
    trace_id: message.correlationId || message.messageId,
    time: message.sentAt || message.createdAt,
    message_type: message.messageType,
    id_number: message.metadata?.idNumber || message.metadata?.checkNumber || '',
    id_number_type: message.metadata?.idNumberType || '',
    application_number: message.applicationNumber || '',
    product_code: message.metadata?.productCode || '',
    product_name: message.metadata?.productName || '',
    affordability_type: message.metadata?.affordabilityType || '',
    requested_amount: message.metadata?.requestedAmount || 0,
    requested_tenure: message.metadata?.requestedTenure || 0,
    deductible_amount: message.metadata?.deductibleAmount || 0,
    desired_deductible_amount: message.metadata?.desiredDeductibleAmount || 0,
    eligible_amount: message.metadata?.eligibleAmount || 0,
    net_loan_amount: message.metadata?.netLoanAmount || 0,
    total_amount_to_pay: message.metadata?.totalAmountToPay || 0,
    monthly_return_amount: message.metadata?.monthlyReturnAmount || 0,
    total_processing_fees: message.metadata?.totalProcessingFees || 0,
    total_insurance: message.metadata?.totalInsurance || 0,
    total_interest_rate_amount: message.metadata?.totalInterestRateAmount || 0,
    other_charges: message.metadata?.otherCharges || 0,
    status: message.status,
    error_message: message.errorMessage || '',
    created_at: message.createdAt,
    updated_at: message.updatedAt,
    tenant_id: message.tenantId
  }));
}

async function getMessages(req, res, messageTypes) {
  const filter = dateFilter(req);
  if (messageTypes) filter.messageType = { $in: messageTypes };
  const messages = await MessageLog.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
  const rows = messageRows(messages);
  return sendRows(res, rows, { count: rows.length, by_status: rows.reduce((result, row) => { result[row.status] = (result[row.status] || 0) + 1; return result; }, {}) });
}

router.get('/possible-loan-charges', async (req, res, next) => {
  try {
    const records = await PossibleLoanCharges.find(dateFilter(req)).sort({ createdAt: -1 }).limit(1000).lean();
    const rows = records.map((record) => ({
      trace_id: record._id.toString(), time: record.createdAt, message_type: 'LOAN_CHARGES_REQUEST',
      id_number: record.idNumber, id_number_type: record.idNumberType, application_number: record.applicationNumber || '',
      product_code: record.productCode, product_name: record.productName, affordability_type: record.affordabilityType || '',
      requested_amount: record.requestedAmount || 0, requested_tenure: record.requestedTenure || 0,
      deductible_amount: record.deductibleAmount || 0, desired_deductible_amount: record.desiredDeductibleAmount || 0,
      eligible_amount: record.eligibleAmount || 0, net_loan_amount: record.netLoanAmount || 0,
      total_amount_to_pay: record.totalAmountToPay || 0, monthly_return_amount: record.monthlyReturnAmount || 0,
      total_processing_fees: record.totalProcessingFees || 0, total_insurance: record.totalInsurance || 0,
      total_interest_rate_amount: record.totalInterestRateAmount || 0, other_charges: record.otherCharges || 0,
      status: record.status, error_message: record.errorMessage || '', created_at: record.createdAt,
      updated_at: record.updatedAt, tenant_id: record.tenantId
    }));
    return sendRows(res, rows, { count: rows.length, by_status: rows.reduce((result, row) => { result[row.status] = (result[row.status] || 0) + 1; return result; }, {}) });
  } catch (error) { return next(error); }
});

router.get('/loan-request', (req, res, next) => getMessages(req, res, ['LOAN_OFFER_REQUEST', 'TOP_UP_OFFER_REQUEST', 'LOAN_TAKEOVER_OFFER_REQUEST', 'LOAN_RESTRUCTURE_REQUEST']).catch(next));
router.get('/loan-offer', (req, res, next) => getMessages(req, res, ['LOAN_INITIAL_APPROVAL_NOTIFICATION']).catch(next));
router.get('/hr-approval', (req, res, next) => getMessages(req, res, ['LOAN_FINAL_APPROVAL_NOTIFICATION']).catch(next));
router.get('/disbursement', (req, res, next) => getMessages(req, res, ['LOAN_DISBURSEMENT_NOTIFICATION', 'TAKEOVER_DISBURSEMENT_NOTIFICATION', 'LOAN_DISBURSEMENT_FAILURE_NOTIFICATION']).catch(next));
router.get('/liquidation', (req, res, next) => getMessages(req, res, ['LOAN_LIQUIDATION_NOTIFICATION']).catch(next));

router.use((error, req, res, next) => {
  res.status(500).json({ success: false, message: error.message });
});

module.exports = router;
