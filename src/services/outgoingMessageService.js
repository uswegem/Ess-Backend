const axios = require('axios');
const digitalSignature = require('../utils/signatureUtils');
const { getMessageId } = require('../utils/messageIdGenerator');
const logger = require('../utils/logger');
const { getUtumishiEndpoint, getApiTimeoutMs } = require('../config/runtimeEnv');
const { getUtumishiHttpsAgent } = require('../utils/utumishiHttpsAgent');
const xml2js = require('xml2js');
const { logOutgoingMessage, updateMessageLog } = require('../utils/messageLogger');
const LoanMappingService = require('../services/loanMappingService');
const { validateOutgoingMessageDetails } = require('../validations/outgoingMessageValidator');
const { parseEssResponseCode } = require('../utils/essResponseParser');

// Dedicated instance (not the shared global axios object) so this request interceptor only
// ever logs Utumishi-bound traffic - not every unrelated axios call elsewhere in the app.
const utumishiClient = axios.create();
utumishiClient.interceptors.request.use((config) => {
  // This runs immediately before axios hands the request off to the http/https adapter -
  // the closest point to actual wire transmission reachable without patching Node's http
  // internals. Logs the literal body/headers axios is about to send, for direct comparison
  // against createSignedXML()'s returned string (logged separately in signatureUtils.js).
  logger.info('📤 Outbound request to Utumishi - body (full content):', config.data);
  logger.info('📤 Outbound request to Utumishi - headers:', JSON.stringify(config.headers));
  logger.info('📤 Outbound request to Utumishi - body byte length:', Buffer.byteLength(config.data, 'utf8'));
  return config;
});

async function sendToESS(signedXml) {
  const essUrl = getUtumishiEndpoint({ required: true });
  return utumishiClient.post(essUrl, signedXml, {
    headers: {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml'
    },
    timeout: getApiTimeoutMs(),
    httpsAgent: getUtumishiHttpsAgent()
  });
}

function extractApplicationNumber(messageDetails) {
  if (!messageDetails) return null;
  if (typeof messageDetails === 'string') {
    const match = messageDetails.match(/<ApplicationNumber>(.*?)<\/ApplicationNumber>/);
    return match ? match[1].trim() : null;
  }
  if (typeof messageDetails === 'object') {
    return messageDetails.ApplicationNumber || null;
  }
  return null;
}

/**
 * Shared core for signing, logging, and sending an outgoing ESS/Utumishi message.
 * Extracted from outgoingMessagesController.triggerOutgoingMessage so any code path
 * (the manual-trigger HTTP route, product submission, etc.) reuses the exact same
 * validation/signing/logging/tenant-derivation logic instead of duplicating it.
 *
 * Callers are responsible for their own authorization/tenant-scope checks specific to
 * their domain (e.g. "does this product belong to this tenant") before calling this -
 * this function only enforces the generic required-field validation for MessageType.
 *
 * @throws Error if MessageDetails fails validation, or if signing/sending fails. On a
 *   send/sign failure after logging has started, the MessageLog entry is marked 'failed'
 *   before the error is re-thrown.
 */
async function sendOutgoingMessage({ tenant, user, correlationId, MessageType, MessageDetails, MsgId }) {
  if (!MessageType || !MessageDetails) {
    const err = new Error('MessageType and MessageDetails are required');
    err.statusCode = 400;
    throw err;
  }

  if (!tenant?.tenantId || !tenant?.fspCode) {
    const err = new Error('No tenant context resolved for this request');
    err.statusCode = 403;
    throw err;
  }

  const Sender = tenant.fspName || 'ZE DONE';
  const Receiver = 'ESS_UTUMISHI';
  const FSPCode = tenant.fspCode;

  const msgId = MsgId || getMessageId(MessageType);

  // Parse MessageDetails if it's a string (XML fragment)
  let parsedMessageDetails = MessageDetails;
  if (typeof MessageDetails === 'string' && MessageDetails.trim().startsWith('<')) {
    try {
      const wrappedXml = `<MessageDetails>${MessageDetails}</MessageDetails>`;
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      const result = await parser.parseStringPromise(wrappedXml);
      parsedMessageDetails = result.MessageDetails;
      logger.info('📝 Parsed MessageDetails from XML string to object');
    } catch (parseError) {
      logger.error('❌ Failed to parse MessageDetails XML string:', parseError.message);
      const err = new Error('Invalid MessageDetails XML format: ' + parseError.message);
      err.statusCode = 400;
      throw err;
    }
  }

  // Structural validation: required fields for this MessageType must be present
  // before anything gets signed or sent to the live ESS gateway.
  const validation = validateOutgoingMessageDetails(MessageType, parsedMessageDetails);
  if (!validation.isValid) {
    const err = new Error(validation.description);
    err.statusCode = 400;
    throw err;
  }

  // Tenant scope check: if the message references a loan application, it must
  // belong to the caller's tenant. Message types with no loan reference
  // (e.g. FSP_BRANCHES, PRODUCT_DETAIL) are exempt.
  const applicationNumber = extractApplicationNumber(parsedMessageDetails);
  if (applicationNumber) {
    const mapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber, true, tenant.tenantId);
    if (!mapping) {
      const err = new Error(`No loan application ${applicationNumber} found for this tenant`);
      err.statusCode = 404;
      throw err;
    }
  }

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

  const signedXml = digitalSignature.createSignedXML(dataObject);

  // Pass msgId through explicitly - it's already embedded in signedXml's Header.MsgId
  // (built above), and logOutgoingMessage must not generate a second, different one for
  // the same send or the log becomes untraceable to what was actually signed/sent.
  let messageLog = await logOutgoingMessage(signedXml, MessageType, {
    applicationNumber,
    tenantId: tenant.tenantId,
    tenantObjectId: tenant.tenantObjectId,
    fspCode: FSPCode,
    correlationId
  }, user?._id || null, msgId);

  try {
    logger.info('Message signed successfully, sending to ESS...');
    const essResponse = await sendToESS(signedXml);
    logger.info('ESS Response received:', essResponse.status);

    const { responseCode, statusDesc } = await parseEssResponseCode(essResponse.data);
    // A 200 HTTP response only means the message reached Utumishi - it says nothing about
    // whether Utumishi actually accepted it. '8000' is ESS/Utumishi's universal success
    // code (the same convention the frontend's isESSSuccess() already applies to inbound
    // responses); anything else - e.g. 8009 "Invalid Signature" - is a rejection and must
    // not be logged or reported as sent.
    const accepted = responseCode === '8000';

    if (messageLog) {
      await updateMessageLog(
        messageLog.messageId,
        accepted ? 'sent' : 'failed',
        essResponse.data,
        accepted ? null : (statusDesc || `Rejected by Utumishi (code ${responseCode})`),
        tenant.tenantId
      );
    }

    return { success: accepted, sent: signedXml, essResponse: essResponse.data, responseCode, statusDesc, messageLog };
  } catch (error) {
    if (messageLog) {
      await updateMessageLog(messageLog.messageId, 'failed', null, error.message, tenant.tenantId);
    }
    throw error;
  }
}

module.exports = { sendOutgoingMessage };
