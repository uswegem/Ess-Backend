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

// Health status endpoint
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

// Authentication status
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

// Clear authentication tokens
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

// Request manager statistics
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

// Reset circuit breaker
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

// Error metrics
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

// Force health check
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

// System diagnostics
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