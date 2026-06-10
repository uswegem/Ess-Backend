/**
 * Circuit Breaker Monitoring Routes
 * 
 * Provides endpoints to monitor circuit breaker health and status
 */

const express = require('express');
const router = express.Router();
const { getCircuitBreakerStatus } = require('../services/cbs.api');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/v1/circuit-breaker/status:
 *   get:
 *     summary: Get circuit breaker status
 *     description: Returns the current state and statistics of all MIFOS API circuit breakers
 *     tags:
 *       - Health & Monitoring
 *     responses:
 *       200:
 *         description: Circuit breaker status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     maker:
 *                       type: object
 *                       description: Circuit breaker status for MIFOS maker API
 *                       properties:
 *                         get:
 *                           $ref: '#/components/schemas/CircuitBreakerHealth'
 *                         post:
 *                           $ref: '#/components/schemas/CircuitBreakerHealth'
 *                         put:
 *                           $ref: '#/components/schemas/CircuitBreakerHealth'
 *                         patch:
 *                           $ref: '#/components/schemas/CircuitBreakerHealth'
 *                         delete:
 *                           $ref: '#/components/schemas/CircuitBreakerHealth'
 *                     checker:
 *                       type: object
 *                       description: Circuit breaker status for MIFOS checker API
 *                       properties:
 *                         get:
 *                           $ref: '#/components/schemas/CircuitBreakerHealth'
 *                         post:
 *                           $ref: '#/components/schemas/CircuitBreakerHealth'
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-21T10:30:00.000Z"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/status', async (req, res) => {
  try {
    logger.info('Circuit breaker status check requested', {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    
    const status = getCircuitBreakerStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting circuit breaker status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve circuit breaker status',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/circuit-breaker/health:
 *   get:
 *     summary: Get circuit breaker health summary
 *     description: Returns a simplified health check for all circuit breakers (OPEN/CLOSED)
 *     tags:
 *       - Health & Monitoring
 *     responses:
 *       200:
 *         description: Health summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 healthy:
 *                   type: boolean
 *                   description: True if all circuit breakers are CLOSED
 *                   example: true
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 12
 *                     open:
 *                       type: integer
 *                       example: 0
 *                     closed:
 *                       type: integer
 *                       example: 11
 *                     halfOpen:
 *                       type: integer
 *                       example: 1
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "MIFOS-Maker-post"
 *                       state:
 *                         type: string
 *                         enum: [OPEN, CLOSED, HALF_OPEN]
 *                         example: "CLOSED"
 *                       errorRate:
 *                         type: string
 *                         example: "2.50%"
 *       500:
 *         description: Server error
 */
router.get('/health', async (req, res) => {
  try {
    const status = getCircuitBreakerStatus();
    
    // Analyze circuit breaker states
    const details = [];
    let totalOpen = 0;
    let totalClosed = 0;
    let totalHalfOpen = 0;
    
    // Process maker circuit breakers
    if (status.maker) {
      Object.keys(status.maker).forEach(method => {
        const cb = status.maker[method];
        if (cb.enabled) {
          details.push({
            name: cb.name,
            state: cb.state,
            errorRate: cb.stats?.errorRate || '0%'
          });
          
          if (cb.state === 'OPEN') totalOpen++;
          else if (cb.state === 'HALF_OPEN') totalHalfOpen++;
          else totalClosed++;
        }
      });
    }
    
    // Process checker circuit breakers
    if (status.checker) {
      Object.keys(status.checker).forEach(method => {
        const cb = status.checker[method];
        if (cb.enabled) {
          details.push({
            name: cb.name,
            state: cb.state,
            errorRate: cb.stats?.errorRate || '0%'
          });
          
          if (cb.state === 'OPEN') totalOpen++;
          else if (cb.state === 'HALF_OPEN') totalHalfOpen++;
          else totalClosed++;
        }
      });
    }
    
    const total = totalOpen + totalClosed + totalHalfOpen;
    const healthy = totalOpen === 0; // System is healthy if no circuits are open
    
    res.json({
      success: true,
      healthy,
      summary: {
        total,
        open: totalOpen,
        closed: totalClosed,
        halfOpen: totalHalfOpen
      },
      details,
      timestamp: status.timestamp
    });
  } catch (error) {
    logger.error('Error getting circuit breaker health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve circuit breaker health',
      message: error.message
    });
  }
});

module.exports = router;
