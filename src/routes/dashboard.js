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

/**
 * @swagger
 * /api/v1/dashboard/activity:
 *   get:
 *     summary: Recent audit activity for dashboard
 *     tags: [Health & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity logs
 */
router.get('/activity', DashboardController.activity);

/**
 * @swagger
 * /api/v1/dashboard/messages:
 *   get:
 *     summary: Pending/failed message count
 *     tags: [Health & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Message counts
 */
router.get('/messages', DashboardController.messages);

/**
 * @swagger
 * /api/v1/dashboard/detail/{metric}:
 *   get:
 *     summary: Drill-down rows backing a dashboard summary card
 *     tags: [Health & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Row-level detail for the given metric
 */
router.get('/detail/:metric', DashboardController.detail);

module.exports = router;
