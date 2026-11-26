const { permissionMiddleware } = require('./authMiddleware');
const { SENSITIVE_MANUAL_TRIGGER_MESSAGE_TYPES } = require('../utils/loanConstants');

const requireTrigger = permissionMiddleware('messages:trigger');
const requireSensitiveTrigger = permissionMiddleware('messages:trigger', 'messages:trigger_sensitive');

// Chooses the permission from the message type being sent
function messageTriggerPermission(req, res, next) {
  const type = req.body?.MessageType;
  // anything but a plain string could slip past the list below
  if (type !== undefined && typeof type !== 'string') {
    return res.status(400).json({ success: false, error: 'MessageType must be a string' });
  }
  const sensitive = SENSITIVE_MANUAL_TRIGGER_MESSAGE_TYPES.includes(String(type || '').trim().toUpperCase());
  return (sensitive ? requireSensitiveTrigger : requireTrigger)(req, res, next);
}

module.exports = { messageTriggerPermission, requireTrigger, requireSensitiveTrigger };
