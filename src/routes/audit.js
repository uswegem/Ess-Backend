const express = require('express');
const router = express.Router();
const AuditController = require('../controllers/auditController');
const { authMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware, permissionMiddleware('audit:read'));

/**
 * @swagger
 * /api/v1/audit/logs:
 *   get:
 *     summary: List audit logs
 *     description: Tenant-scoped audit trail. Super-admins may pass allTenants=true for cross-tenant view.
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *         description: Filter by action (login, logout, api_key_create, tenant_create, etc.)
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [success, failure] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *       - in: query
 *         name: allTenants
 *         schema: { type: boolean }
 *         description: Super-admin only — list logs across all tenants
 *     responses:
 *       200:
 *         description: Paginated audit logs
 *       403:
 *         description: Missing audit:read permission or tenant context
 */
router.get('/logs', AuditController.getAuditLogs);

/**
 * @swagger
 * /api/v1/audit/stats:
 *   get:
 *     summary: Audit statistics
 *     description: 30-day audit statistics for the active tenant.
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit stats returned
 *       403:
 *         description: Missing audit:read permission
 */
router.get('/stats', AuditController.getAuditStats);

module.exports = router;
