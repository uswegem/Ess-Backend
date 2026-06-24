const express = require('express');
const router = express.Router();
const { 
  authManager, 
  healthMonitor, 
  errorHandler, 
  requestManager, 
  getHealthStatus, 
  clearTokenCache, 
  resetCircuitBreaker 
} = require('../services/cbs.api');
const logger = require('../utils/logger');

/**
 * MIFOS Administration and Monitoring Endpoints
 */

/**
 * @swagger
 * /api/v1/mifos/health:
 *   get:
 *     summary: MIFOS/CBS health status
 *     description: Global MIFOS connection health (M3). Per-tenant health available via tenant integration endpoint in M4.
 *     tags: [MIFOS Admin]
 *     responses:
 *       200:
 *         description: Health status
 *       500:
 *         description: Error retrieving health
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await getHealthStatus();
    res.json({
      success: true,
      data: healthStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error getting MIFOS health status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/mifos/auth/status:
 *   get:
 *     summary: MIFOS authentication status
 *     tags: [MIFOS Admin]
 *     responses:
 *       200:
 *         description: Token availability and last refresh time
 */
router.get('/auth/status', async (req, res) => {
  try {
    const authHeader = await authManager.getAuthHeader();
    const hasValidToken = !!authHeader.Authorization;
    
    res.json({
      success: true,
      data: {
        hasValidToken,
        tokenType: 'Bearer',
        lastRefresh: authManager.lastTokenRefresh || 'Never'
      }
    });
  } catch (error) {
    logger.error('❌ Error getting auth status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/mifos/auth/clear:
 *   post:
 *     summary: Clear MIFOS auth token cache
 *     description: Forces re-authentication on next CBS request (M3).
 *     tags: [MIFOS Admin]
 *     responses:
 *       200:
 *         description: Tokens cleared
 */
router.post('/auth/clear', async (req, res) => {
  try {
    clearTokenCache();
    logger.info('🔄 Authentication tokens cleared');
    
    res.json({
      success: true,
      message: 'Authentication tokens cleared successfully'
    });
  } catch (error) {
    logger.error('❌ Error clearing tokens:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/mifos/requests/stats:
 *   get:
 *     summary: MIFOS request manager statistics
 *     tags: [MIFOS Admin]
 *     responses:
 *       200:
 *         description: Request stats
 */
router.get('/requests/stats', async (req, res) => {
  try {
    const stats = requestManager.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error getting request stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/mifos/circuit-breaker/reset:
 *   post:
 *     summary: Reset MIFOS circuit breaker
 *     tags: [MIFOS Admin]
 *     responses:
 *       200:
 *         description: Circuit breaker reset
 */
router.post('/circuit-breaker/reset', async (req, res) => {
  try {
    resetCircuitBreaker();
    logger.info('🔄 Circuit breaker reset');
    
    res.json({
      success: true,
      message: 'Circuit breaker reset successfully'
    });
  } catch (error) {
    logger.error('❌ Error resetting circuit breaker:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/mifos/errors/metrics:
 *   get:
 *     summary: MIFOS error metrics
 *     tags: [MIFOS Admin]
 *     responses:
 *       200:
 *         description: Error handler metrics
 */
router.get('/errors/metrics', async (req, res) => {
  try {
    const metrics = errorHandler.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error getting error metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/mifos/health/check:
 *   post:
 *     summary: Force MIFOS health check
 *     tags: [MIFOS Admin]
 *     responses:
 *       200:
 *         description: Health check result
 */
router.post('/health/check', async (req, res) => {
  try {
    const result = await healthMonitor.performHealthCheck();
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error performing health check:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/mifos/diagnostics:
 *   get:
 *     summary: MIFOS system diagnostics
 *     description: Aggregated health, auth, request, and error metrics (M3).
 *     tags: [MIFOS Admin]
 *     responses:
 *       200:
 *         description: Full diagnostics payload
 */
router.get('/diagnostics', async (req, res) => {
  try {
    const [healthStatus, authStatus, requestStats, errorMetrics] = await Promise.all([
      getHealthStatus(),
      authManager.getAuthHeader().then(h => !!h.Authorization).catch(() => false),
      requestManager.getStats(),
      errorHandler.getMetrics()
    ]);
    
    res.json({
      success: true,
      data: {
        health: healthStatus,
        authentication: {
          hasValidToken: authStatus,
          lastRefresh: authManager.lastTokenRefresh || 'Never'
        },
        requests: requestStats,
        errors: errorMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error getting diagnostics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
