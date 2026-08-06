const logger = require('./logger');

async function sendFailureNotification(parsedData, error) {
    const failureNotification = {
        Data: {
            Header: {
                Sender: process.env.FSP_NAME || "ZE DONE",
                Receiver: "ESS_UTUMISHI",
                FSPCode: parsedData.Document.Data.Header.FSPCode,
                MsgId: `FAIL_${Date.now()}`,
                MessageType: "LOAN_DISBURSEMENT_FAILURE_NOTIFICATION"
            },
            MessageDetails: {
                ApplicationNumber: parsedData.Document.Data.MessageDetails.ApplicationNumber,
                Reason: error.message
            }
        }
    };

    const signedFailureXml = digitalSignature.createSignedXML(failureNotification.Data);
    await forwardToThirdParty(signedFailureXml, "LOAN_DISBURSEMENT_FAILURE_NOTIFICATION");
    logger.info('✅ LOAN_DISBURSEMENT_FAILURE_NOTIFICATION sent successfully');
}