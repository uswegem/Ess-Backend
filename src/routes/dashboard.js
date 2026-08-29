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
 *     summary: Row-level data behind a MiraCore Summary card (click-through detail page)
 *     tags: [Health & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: metric
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Underlying rows for the requested metric
 */
router.get('/detail/:metric', DashboardController.detail);

/**
 * @swagger
 * /api/v1/dashboard/detail/{metric}/export/pdf:
 *   get:
 *     summary: PDF export of a detail page's rows
 *     tags: [Health & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: metric
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf: {}
 */
router.get('/detail/:metric/export/pdf', DashboardController.exportPdf);

module.exports = router;
