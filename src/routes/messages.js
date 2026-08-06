const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');
const { authMiddleware, roleMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Anyone who can trigger messages can also view/read their history
router.get('/logs', permissionMiddleware('messages:trigger'), MessageController.getMessageLogs);

// Only super admins and admins can access message management/ops actions
router.get('/stats', roleMiddleware(['super_admin', 'admin']), MessageController.getMessageStats);
router.get('/types', roleMiddleware(['super_admin', 'admin']), MessageController.getMessageTypes);

router.get('/:messageId', permissionMiddleware('messages:trigger'), MessageController.getMessageById);
router.post('/:messageId/resend', roleMiddleware(['super_admin', 'admin']), MessageController.resendMessage);

module.exports = router;