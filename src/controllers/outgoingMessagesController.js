const logger = require('../utils/logger');
const LOAN_CONSTANTS = require('../utils/loanConstants');
const { sendOutgoingMessage, validateMessageDetailsXml } = require('../services/outgoingMessageService');

exports.triggerOutgoingMessage = async (req, res) => {
  const tenant = req.tenant;

  try {
    const { MsgId, MessageType, MessageDetails } = req.body;

    if (!MessageType || !MessageDetails) {
      return res.status(400).json({ success: false, error: 'MessageType and MessageDetails are required' });
    }

    if (!tenant?.tenantId || !tenant?.fspCode) {
      return res.status(403).json({ success: false, error: 'No tenant context resolved for this request' });
    }

    // Money-movement / loan-finality message types require the elevated permission.
    // This check is specific to the manual-trigger HTTP route (it depends on req.authContext),
    // so it lives here rather than in the shared outgoingMessageService core.
    if (LOAN_CONSTANTS.SENSITIVE_MANUAL_TRIGGER_MESSAGE_TYPES.includes(MessageType)) {
      const granted = req.authContext?.permissions || [];
      if (!req.authContext?.isSuperAdmin && !granted.includes('messages:trigger_sensitive')) {
        return res.status(403).json({
          success: false,
          error: `Message type ${MessageType} requires the messages:trigger_sensitive permission`
        });
      }
    }

    const result = await sendOutgoingMessage({
      tenant,
      user: req.user,
      correlationId: req.correlationId,
      MessageType,
      MessageDetails,
      MsgId
    });

    res.status(200).json({
      success: true,
      sent: result.sent,
      essResponse: result.essResponse,
      responseCode: result.responseCode,
      statusDesc: result.statusDesc
    });
  } catch (error) {
    logger.error('Error sending outgoing message:', error.message);
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

// Pre-submit check only - runs the exact same parse+required-field validation
// sendOutgoingMessage() uses internally, without any of what follows it there (no tenant-
// scope loan lookup, no signing, no MessageLog entry, nothing sent to Utumishi). Gated at
// the same base 'messages:trigger' permission as the send route itself (not the elevated
// 'messages:trigger_sensitive') - validating a sensitive message type's structure doesn't
// send/disclose/create anything, so there's no reason to require the higher permission here.
exports.validateOutgoingMessage = async (req, res) => {
  try {
    const { MessageType, MessageDetails } = req.body;

    if (!MessageType || !MessageDetails) {
      return res.status(400).json({ success: false, error: 'MessageType and MessageDetails are required' });
    }

    await validateMessageDetailsXml(MessageType, MessageDetails);

    res.status(200).json({ success: true, valid: true });
  } catch (error) {
    // Always HTTP 200 here (unlike the send route) - "the message failed validation" is a
    // normal, expected result of calling a validate endpoint, not a request/server error.
    // Returning a non-2xx would make axios throw on the frontend, forcing it through a
    // catch block for what should be an ordinary pass/fail response.
    res.status(200).json({
      success: true,
      valid: false,
      error: error.message,
      errors: error.errors || undefined
    });
  }
};
