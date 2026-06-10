const express = require('express');
const router = express.Router();
const AuditController = require('../controllers/auditController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// Only super admins and admins can access audit logs
router.use(authMiddleware, roleMiddleware(['super_admin', 'admin']));

router.get('/logs', AuditController.getAuditLogs);
router.get('/stats', AuditController.getAuditStats);

module.exports = router;