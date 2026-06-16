const express = require('express');
const router = express.Router();
const AuditController = require('../controllers/auditController');
const { authMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware, permissionMiddleware('audit:read'));

router.get('/logs', AuditController.getAuditLogs);
router.get('/stats', AuditController.getAuditStats);

module.exports = router;