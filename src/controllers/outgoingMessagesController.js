const logger = require('../utils/logger');
const LOAN_CONSTANTS = require('../utils/loanConstants');
const { sendOutgoingMessage } = require('../services/outgoingMessageService');

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
