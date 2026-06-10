const logger = require('./logger');

const digitalSignature = require('./signatureUtils');
const thirdPartyService = require('../services/thirdPartyService');
const { formatDateForUTUMISHI } = require('./dateUtils');

/**
 * Create and send a LOAN_DISBURSEMENT_NOTIFICATION
 * This is to be triggered manually after LOAN_FINAL_APPROVAL_NOTIFICATION is processed
 */
async function sendDisbursementNotification(loanDetails) {
    const notificationData = {
        Header: {
            Sender: 'ZE DONE',
            Receiver: 'ESS_UTUMISHI',
            FSPCode: 'FL8090',
            MsgId: `ESS${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
            MessageType: 'LOAN_DISBURSEMENT_NOTIFICATION'
        },
        MessageDetails: {
            ApplicationNumber: loanDetails.applicationNumber,
            Reason: loanDetails.reason || 'Loan successfully disbursed',
            FSPReferenceNumber: loanDetails.fspReferenceNumber,
            LoanNumber: loanDetails.loanNumber,
            TotalAmountToPay: loanDetails.totalAmountToPay || loanDetails.amount,
            DisbursementDate: formatDateForUTUMISHI(new Date())
        }
    };

    // Sign the notification
    const signedNotification = await digitalSignature.createSignedXML(notificationData);

    // Send to ESS
    return thirdPartyService.sendToServer(signedNotification, 'LOAN_DISBURSEMENT_NOTIFICATION');
}

module.exports = {
    sendDisbursementNotification
};