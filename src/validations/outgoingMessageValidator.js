const Joi = require('joi');

// Required top-level MessageDetails fields per outgoing MessageType, derived from the
// XML templates in ess2/frontend's src/services/messages/messageTypes.js (MESSAGE_TYPES).
// Keep this map in sync with that file when message types/templates change there -
// same duplication pattern already used for SENSITIVE_MESSAGE_TYPES (see that file's header).
const REQUIRED_FIELDS_BY_MESSAGE_TYPE = {
  LOAN_DISBURSEMENT_NOTIFICATION: ['ApplicationNumber', 'Reason', 'FSPReferenceNumber', 'LoanNumber', 'TotalAmountToPay', 'DisbursementDate'],
  LOAN_DISBURSEMENT_FAILURE_NOTIFICATION: ['ApplicationNumber', 'Reason'],
  LOAN_INITIAL_APPROVAL_NOTIFICATION: ['ApplicationNumber', 'Reason', 'FSPReferenceNumber', 'LoanNumber', 'TotalAmountToPay', 'OtherCharges', 'Approval'],
  LOAN_LIQUIDATION_NOTIFICATION: ['ApplicationNumber', 'LoanNumber', 'Remarks'],
  FULL_LOAN_REPAYMENT_NOTIFICATION: ['CheckNumber', 'ApplicationNumber', 'LoanNumber', 'PaymentReference', 'DeductionCode', 'PaymentDescription', 'PaymentDate', 'PaymentAmount', 'LoanBalance'],
  PARTIAL_LOAN_REPAYMENT_NOTIFICATION: ['CheckNumber', 'ApplicationNumber', 'LoanNumber', 'PaymentReference', 'DeductionCode', 'PaymentDescription', 'PaymentDate', 'MaturityDate', 'PaymentAmount', 'LoanBalance'],
  PAYMENT_ACKNOWLEDGMENT_NOTIFICATION: ['ApplicationNumber', 'Remarks', 'FSPReferenceNumber', 'LoanNumber', 'PaymentStatus'],
  FULL_LOAN_REPAYMENT_REQUEST: ['LoanNumber', 'CheckNumber', 'ApplicationNumber'],
  LOAN_RESTRUCTURE_REQUEST_FSP: ['ApplicationNumber', 'LoanNumber', 'InstallmentAmount', 'OutstandingBalance', 'PrincipalBalance', 'ValidityDate', 'LastRepaymentDate', 'MaturityDate', 'Reason', 'NewInstallmentAmount', 'NewInsuranceAmount', 'NewProcessingFee', 'NewInterestAmount', 'NewPrincipalAmount', 'NewTotalAmountPayable', 'OtherCharges', 'NewTenure', 'ProductCode', 'DeductionCode', 'FSPReferenceNumber'],
  TAKEOVER_DISBURSEMENT_NOTIFICATION: ['ApplicationNumber', 'Reason', 'FSPReferenceNumber', 'LoanNumber', 'TotalAmountToPay', 'DisbursementDate', 'PaymentAdvice', 'PaymentAdviceAttachment'],
  DEFAULTER_DETAILS_TO_EMPLOYER: ['VoteCode', 'VoteName', 'CheckNumber', 'LoanNumber', 'FirstName', 'MiddleName', 'LastName', 'InstallmentAmount', 'DeductionName', 'DeductionCode', 'OutstandingBalance', 'LastPayDate'],
  PRODUCT_DETAIL: ['DeductionCode', 'ProductCode', 'ProductName', 'ProductDescription', 'ForExecutive', 'MinimumTenure', 'MaximumTenure', 'InterestRate', 'ProcessFee', 'Insurance', 'MaxAmount', 'MinAmount', 'RepaymentType', 'Currency', 'InsuranceType', 'ShariaFacility'],
  PRODUCT_DECOMMISSION: ['ProductCode'],
  FSP_BRANCHES: ['BranchDetail'],
  RESPONSE: ['ResponseCode', 'Description'],
};

// Types with no required-field list (unknown/free-form types) are not blocked -
// we don't invent rules that don't exist in the template catalog.
function validateOutgoingMessageDetails(messageType, parsedMessageDetails) {
  const requiredFields = REQUIRED_FIELDS_BY_MESSAGE_TYPE[messageType];
  if (!requiredFields) {
    return { isValid: true };
  }

  const schemaShape = {};
  requiredFields.forEach((field) => {
    schemaShape[field] = Joi.string().trim().min(1).required();
  });

  const schema = Joi.object(schemaShape).unknown(true);
  const { error } = schema.validate(parsedMessageDetails || {}, { abortEarly: false });

  if (error) {
    return {
      isValid: false,
      errorCode: '8001',
      description: `MessageDetails validation failed for ${messageType}: ${error.details.map((d) => d.message).join('; ')}`,
      // Individual field-level messages (e.g. "\"ApplicationNumber\" is not allowed to be
      // empty") - added for the validate-only endpoint's per-field error list, additive to
      // the existing isValid/errorCode/description shape every other caller already uses.
      errors: error.details.map((d) => d.message),
    };
  }

  return { isValid: true };
}

module.exports = { validateOutgoingMessageDetails, REQUIRED_FIELDS_BY_MESSAGE_TYPE };
