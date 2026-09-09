const axios = require('axios');
const digitalSignature = require('../utils/signatureUtils');
const { getMessageId } = require('../utils/messageIdGenerator');
const logger = require('../utils/logger');
const { getUtumishiEndpoint, getApiTimeoutMs } = require('../config/runtimeEnv');
const { getUtumishiHttpsAgent } = require('../utils/utumishiAgent');
const xml2js = require('xml2js');
const MessageLog = require('../models/MessageLog');
const LoanMappingService = require('../services/loanMappingService');

async function sendToESS(signedXml) {
  const essUrl = getUtumishiEndpoint({ required: true });
  return axios.post(essUrl, signedXml, {
    headers: {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml'
    },
    httpsAgent: getUtumishiHttpsAgent(),
    timeout: getApiTimeoutMs()
  });
}

// MessageLog is otherwise completely unwritten anywhere in this codebase
// (only ever read from, via messageController.getMessageLogs) -- this is
// the first real writer. Never lets a logging failure block the actual
// response to the caller; the send itself already happened by this point.
async function recordMessageLog({ msgId, messageType, direction, status, xmlPayload, response, errorMessage, applicationNumber, loanNumber, fspReferenceNumber, sender, receiver, tenantId, sentBy }) {
  try {
    await MessageLog.create({
      tenantId,
      messageId: msgId,
      messageType,
      direction,
      status,
      xmlPayload,
      response,
      errorMessage,
      applicationNumber,
      loanNumber,
      fspReferenceNumber,
      sender,
      receiver,
      sentBy,
      sentAt: new Date()
    });
  } catch (logError) {
    logger.warn('Failed to write MessageLog entry for outgoing message', { messageType, applicationNumber, error: logError.message });
  }
}

exports.triggerOutgoingMessage = async (req, res) => {
  const { Sender = 'ZE DONE', Receiver = 'ESS_UTUMISHI', FSPCode = 'FL8090', MsgId, MessageType, MessageDetails } = req.body;
  let msgId;
  let parsedMessageDetails = MessageDetails;

  try {
    if (!MessageType || !MessageDetails) {
      return res.status(400).json({ success: false, error: 'MessageType and MessageDetails are required' });
    }

    msgId = MsgId || getMessageId(MessageType);

    // Parse MessageDetails if it's a string (XML fragment)
    if (typeof MessageDetails === 'string' && MessageDetails.trim().startsWith('<')) {
      try {
        // Wrap in a root element for parsing
        const wrappedXml = `<MessageDetails>${MessageDetails}</MessageDetails>`;
        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
        const result = await parser.parseStringPromise(wrappedXml);
        parsedMessageDetails = result.MessageDetails;
        logger.info('📝 Parsed MessageDetails from XML string to object');
      } catch (parseError) {
        logger.error('❌ Failed to parse MessageDetails XML string:', parseError.message);
        return res.status(400).json({
          success: false,
          error: 'Invalid MessageDetails XML format: ' + parseError.message
        });
      }
    }

    // Build data object
    const dataObject = {
      Header: {
        Sender,
        Receiver,
        FSPCode,
        MsgId: msgId,
        MessageType
      },
      MessageDetails: parsedMessageDetails
    };

    logger.info('Building outgoing message:', MessageType);

    // Use createSignedXML for proper signature generation
    const signedXml = digitalSignature.createSignedXML(dataObject);

    logger.info('Message signed successfully, sending to ESS...');

    const essResponse = await sendToESS(signedXml);

    logger.info('ESS Response received:', essResponse.status);

    const applicationNumber = parsedMessageDetails?.ApplicationNumber;
    const loanNumber = parsedMessageDetails?.LoanNumber;
    const fspReferenceNumber = parsedMessageDetails?.FSPReferenceNumber;

    await recordMessageLog({
      msgId,
      messageType: MessageType,
      direction: 'outgoing',
      status: 'sent',
      xmlPayload: signedXml,
      response: typeof essResponse.data === 'string' ? essResponse.data : JSON.stringify(essResponse.data),
      applicationNumber,
      loanNumber,
      fspReferenceNumber,
      sender: Sender,
      receiver: Receiver,
      tenantId: req.tenant?.tenantId,
      sentBy: req.user?._id
    });

    // Bring this endpoint in line with what the automated flow
    // (loanOfferHandler.js) does on a successful LOAN_INITIAL_APPROVAL_NOTIFICATION
    // send: advance the loan mapping's own status and record what was sent,
    // rather than leaving it looking un-approved after a real approval went out.
    if (MessageType === 'LOAN_INITIAL_APPROVAL_NOTIFICATION' && applicationNumber) {
      try {
        const mapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber);
        if (mapping) {
          await LoanMappingService.updateStatus(applicationNumber, 'INITIAL_APPROVAL_SENT', {
            essLoanNumberAlias: loanNumber,
            fspReferenceNumber,
            initialOfferSentAt: mapping.initialOfferSentAt || new Date(),
            metadata: {
              ...(mapping.metadata || {}),
              callbacksSent: [
                ...((mapping.metadata?.callbacksSent) || []),
                {
                  type: 'LOAN_INITIAL_APPROVAL_NOTIFICATION',
                  sentAt: new Date(),
                  status: 'success',
                  loanNumber,
                  fspReferenceNumber,
                  context: 'manual-trigger'
                }
              ]
            }
          }, req.tenant?.tenantId);
        }
      } catch (statusError) {
        // Same principle as loanOfferHandler.js: a failure to update the
        // loan mapping's own status must not undo or mask the fact that
        // the real notification was already sent successfully.
        logger.warn('Failed to update loan mapping status after successful LOAN_INITIAL_APPROVAL_NOTIFICATION send', {
          applicationNumber,
          error: statusError.message
        });
      }
    }

    res.status(200).json({ success: true, sent: signedXml, essResponse: essResponse.data });
  } catch (error) {
    logger.error('Error sending outgoing message:', error.message);

    await recordMessageLog({
      msgId,
      messageType: MessageType,
      direction: 'outgoing',
      status: 'failed',
      xmlPayload: '',
      errorMessage: error.message,
      applicationNumber: parsedMessageDetails?.ApplicationNumber,
      loanNumber: parsedMessageDetails?.LoanNumber,
      fspReferenceNumber: parsedMessageDetails?.FSPReferenceNumber,
      sender: Sender,
      receiver: Receiver,
      tenantId: req.tenant?.tenantId,
      sentBy: req.user?._id
    });

    res.status(500).json({ success: false, error: error.message });
  }
};
