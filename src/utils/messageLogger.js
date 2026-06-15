const logger = require('./logger');
const MessageLog = require('../models/MessageLog');
const { getMessageId } = require('./messageIdGenerator');
const { buildTenantQuery } = require('./tenantQuery');

/**
 * Logs an outgoing message to the MessageLog collection
 * @param {string} xmlPayload - The signed XML payload
 * @param {string} messageType - The type of message being sent
 * @param {Object} metadata - Additional metadata (applicationNumber, loanNumber, etc.)
 * @param {string} userId - ID of the user sending the message (optional)
 * @returns {Object} The created message log document
 */
async function logOutgoingMessage(xmlPayload, messageType, metadata = {}, userId = null) {
  try {
    // Generate a unique message ID
    const messageId = getMessageId(messageType);

    // Extract common fields from metadata
    const {
      applicationNumber,
      loanNumber,
      fspReferenceNumber,
      tenantId,
      tenantObjectId,
      fspCode,
      correlationId,
      ...otherMetadata
    } = metadata;

    const baseDoc = {
      messageId,
      messageType,
      direction: 'outgoing',
      status: 'pending',
      xmlPayload,
      applicationNumber,
      loanNumber,
      fspReferenceNumber,
      sentBy: userId,
      fspCode,
      correlationId,
      metadata: otherMetadata
    };

    if (tenantId) {
      baseDoc.tenantId = tenantId;
      if (tenantObjectId) baseDoc.tenant = tenantObjectId;
    }

    const messageLog = new MessageLog(baseDoc);

    await messageLog.save();
    logger.info(`Logged outgoing message: ${messageId} (${messageType})`);

    return messageLog;
  } catch (error) {
    logger.error('Error logging outgoing message:', error);
    // Don't throw error - logging failure shouldn't break the main flow
    return null;
  }
}

/**
 * Updates a message log with the result of sending
 * @param {string} messageId - The message ID to update
 * @param {string} status - The status ('sent', 'failed')
 * @param {string|Object} response - The response from the third party
 * @param {string} errorMessage - Error message if failed
 */
async function updateMessageLog(messageId, status, response = null, errorMessage = null, tenantId = null) {
  try {
    const updateData = {
      status,
      sentAt: new Date()
    };

    if (response) {
      updateData.response = typeof response === 'string' ? response : JSON.stringify(response);
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    const filter = tenantId ? buildTenantQuery(tenantId, { messageId }) : { messageId };

    await MessageLog.findOneAndUpdate(filter, updateData);

    logger.info(`Updated message log ${messageId} with status: ${status}`);
  } catch (error) {
    logger.error('Error updating message log:', error);
    // Don't throw error - logging failure shouldn't break the main flow
  }
}

/**
 * Logs an incoming message to the MessageLog collection
 * @param {string} xmlPayload - The received XML payload
 * @param {string} messageType - The type of message received
 * @param {Object} metadata - Additional metadata
 */
async function logIncomingMessage(xmlPayload, messageType, metadata = {}) {
  try {
    // Generate a unique message ID for incoming messages
    const messageId = `IN_${getMessageId(messageType)}`;

    const {
      applicationNumber,
      loanNumber,
      fspReferenceNumber,
      ...otherMetadata
    } = metadata;

    const messageLog = new MessageLog({
      messageId,
      messageType,
      direction: 'incoming',
      status: 'received',
      xmlPayload,
      applicationNumber,
      loanNumber,
      fspReferenceNumber,
      metadata: otherMetadata
    });

    await messageLog.save();
    logger.info(`Logged incoming message: ${messageId} (${messageType})`);

    return messageLog;
  } catch (error) {
    logger.error('Error logging incoming message:', error);
    return null;
  }
}

module.exports = {
  logOutgoingMessage,
  updateMessageLog,
  logIncomingMessage
};