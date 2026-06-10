const logger = require('./logger');

/**
 * Generates a unique message ID in the format ZDYYMMDDHHMNXXX
 * ZD = ZE DONE (tenant code)
 * YY = Year (last 2 digits)
 * MM = Month (2 digits)
 * DD = Date (2 digits)
 * HH = Hour (2 digits)
 * MN = Minutes (2 digits)
 * XXX = Random 4 digits
 * @returns {string} Message ID
 */
function generateMessageId() {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const date = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    return `ZD${year}${month}${date}${hours}${minutes}${random}`;
}

// Message type specific ID generators
const messageIdGenerators = {
    RESPONSE: () => `RESP_${generateMessageId()}`,
    ACCOUNT_VALIDATION_RESPONSE: () => `AVAL_${generateMessageId()}`,
    DEFAULTER_DETAILS_TO_EMPLOYER: () => `DDTE_${generateMessageId()}`,
    FSP_BRANCHES: () => `FSPB_${generateMessageId()}`,
    FULL_LOAN_REPAYMENT_NOTIFICATION: () => `FLRN_${generateMessageId()}`,
    FULL_LOAN_REPAYMENT_REQUEST: () => `FLRR_${generateMessageId()}`,
    LOAN_CHARGES_RESPONSE: () => `LCHR_${generateMessageId()}`,
    LOAN_DISBURSEMENT_FAILURE_NOTIFICATION: () => `LDFN_${generateMessageId()}`,
    LOAN_DISBURSEMENT_NOTIFICATION: () => `LDIS_${generateMessageId()}`,
    LOAN_INITIAL_APPROVAL_NOTIFICATION: () => `LIAN_${generateMessageId()}`,
    LOAN_LIQUIDATION_NOTIFICATION: () => `LLIQ_${generateMessageId()}`,
    LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE: () => `LRAR_${generateMessageId()}`,
    LOAN_RESTRUCTURE_BALANCE_REQUEST: () => `LRBR_${generateMessageId()}`,
    LOAN_RESTRUCTURE_BALANCE_RESPONSE: () => `LRBS_${generateMessageId()}`,
    LOAN_RESTRUCTURE_REQUEST_FSP: () => `LRRF_${generateMessageId()}`,
    LOAN_STATUS_REQUEST: () => `LSTR_${generateMessageId()}`,
    LOAN_TAKEOVER_BALANCE_RESPONSE: () => `LTBR_${generateMessageId()}`,
    LOAN_TOP_UP_BALANCE_RESPONSE: () => `LTUB_${generateMessageId()}`,
    PARTIAL_LOAN_REPAYMENT_NOTIFICATION: () => `PLRN_${generateMessageId()}`,
    PARTIAL_REPAYMENT_OFF_BALANCE_RESPONSE: () => `PROR_${generateMessageId()}`,
    PAYMENT_ACKNOWLEDGMENT_NOTIFICATION: () => `PACK_${generateMessageId()}`,
    PRODUCT_DECOMMISSION: () => `PDEC_${generateMessageId()}`,
    PRODUCT_DETAIL: () => `PDET_${generateMessageId()}`,
    TAKEOVER_DISBURSEMENT_NOTIFICATION: () => `TDON_${generateMessageId()}`
};

/**
 * Generates a message ID for a specific message type
 * @param {string} messageType - The type of message
 * @returns {string} Message ID with prefix based on message type
 */
function getMessageId(messageType) {
    const generator = messageIdGenerators[messageType];
    if (!generator) {
        logger.warn(`No specific generator for message type: ${messageType}`);
        return generateMessageId(); // Fallback to basic ID
    }
    return generator();
}

module.exports = {
    generateMessageId,
    getMessageId
};