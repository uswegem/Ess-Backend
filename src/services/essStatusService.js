/**
 * Utumishi's own view of an application, learned from LOAN_STATUS_REQUEST, and
 * the manual disbursement notification suggested from it. This is separate from
 * LoanMapping.status, which is our view and is never changed here.
 */
const logger = require('../utils/logger');
const LoanMapping = require('../models/LoanMapping');
const { formatDateTimeForUTUMISHI } = require('../utils/dateUtils');

const AWAITING_DISBURSEMENT = 'SUBMITTED_FOR_DISBURSEMENT';
// How long Utumishi's answer is trusted before a new status request is needed
const STATUS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SUCCESS_RESPONSE_CODE = '8000';

function responseCodeOf(xml) {
  return String(xml || '').match(/<ResponseCode>\s*(.*?)\s*<\/ResponseCode>/)?.[1];
}

/** "Status : X, Description : ..." from a successful status response, else null. */
function parseEssStatus(xml) {
  if (responseCodeOf(xml) !== SUCCESS_RESPONSE_CODE) return null;
  return String(xml).match(/<Description>\s*Status\s*:\s*([A-Z_]+)/)?.[1] || null;
}

async function updateLoan(applicationNumber, tenantId, fields) {
  const filter = { essApplicationNumber: applicationNumber };
  if (tenantId) filter.tenantId = tenantId;
  // a status check is not a change to the loan, so updatedAt is left alone
  await LoanMapping.updateOne(filter, { $set: fields }, { timestamps: false });
}

/** Never throws: failing to remember the answer must not fail the request. */
async function recordStatusResponse(applicationNumber, xml, tenantId) {
  try {
    const essStatus = parseEssStatus(xml);
    if (!essStatus) return;
    await updateLoan(applicationNumber, tenantId, { essStatus, essStatusCheckedAt: new Date() });
  } catch (error) {
    logger.warn('Failed to save ESS status', { applicationNumber, error: error.message });
  }
}

/** Remembers an accepted notification, which hides the suggestion until the next status check. */
async function recordDisbursementNotified(applicationNumber, xml, tenantId) {
  try {
    if (!applicationNumber || responseCodeOf(xml) !== SUCCESS_RESPONSE_CODE) return;
    await updateLoan(applicationNumber, tenantId, { essDisbursementNotifiedAt: new Date() });
  } catch (error) {
    logger.warn('Failed to save disbursement notification time', { applicationNumber, error: error.message });
  }
}

function escapeXml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The same fields the automatic notification sends, filled from the loan record. */
function disbursementMessageDetails(loan) {
  const approval = loan.metadata?.finalApprovalDetails || {};
  const fields = {
    ApplicationNumber: loan.essApplicationNumber,
    Reason: 'Loan successfully disbursed',
    FSPReferenceNumber: approval.fspReferenceNumber || loan.fspReferenceNumber,
    LoanNumber: approval.loanNumber || loan.essLoanNumberAlias,
    TotalAmountToPay: loan.requestedAmount,
    DisbursementDate: formatDateTimeForUTUMISHI(loan.disbursedAt)
  };
  return Object.entries(fields).map(([name, value]) => `<${name}>${escapeXml(value)}</${name}>`).join('');
}

/** A suggestion when Utumishi recently said it awaits a disbursement we have made, else null. */
function disbursementSuggestion(loan, now = new Date()) {
  const checkedAt = loan.essStatusCheckedAt;
  if (loan.status !== 'DISBURSED' || loan.essStatus !== AWAITING_DISBURSEMENT || !checkedAt) return null;
  if (now - checkedAt > STATUS_MAX_AGE_MS) return null;
  if (loan.essDisbursementNotifiedAt && loan.essDisbursementNotifiedAt >= checkedAt) return null;
  // without a real disbursement date there is nothing truthful to pre-fill
  if (!loan.disbursedAt) return null;
  return {
    messageType: 'LOAN_DISBURSEMENT_NOTIFICATION',
    reason: 'Utumishi still shows this loan as submitted for disbursement, but it has been disbursed.',
    requiresConfirmation: true,
    messageDetails: disbursementMessageDetails(loan)
  };
}

module.exports = {
  parseEssStatus,
  recordStatusResponse,
  recordDisbursementNotified,
  disbursementSuggestion,
  STATUS_MAX_AGE_MS
};
