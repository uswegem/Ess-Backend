const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// Only super admins and admins can access message management
router.use(authMiddleware, roleMiddleware(['super_admin', 'admin']));

// Get message logs with filtering and pagination
router.get('/logs', MessageController.getMessageLogs);

// Get message statistics
router.get('/stats', MessageController.getMessageStats);

// Get available message types
router.get('/types', MessageController.getMessageTypes);

// Get specific message by ID
router.get('/:messageId', MessageController.getMessageById);

// Resend a message
router.post('/:messageId/resend', MessageController.resendMessage);

module.exports = router;