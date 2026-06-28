const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { authMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware, permissionMiddleware('dashboard:read'));

/**
 * @swagger
 * /api/v1/dashboard/overview:
 *   get:
 *     summary: Dashboard KPIs (tenant-scoped)
 *     tags: [Health & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview statistics
 */
router.get('/overview', DashboardController.overview);
router.get('/activity', DashboardController.activity);
router.get('/messages', DashboardController.messages);

module.exports = router;
