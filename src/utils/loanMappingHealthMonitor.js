const logger = require('../utils/logger');
const LoanMapping = require('../models/LoanMapping');

/**
 * Health monitoring and alerting system for loan mapping operations
 */
class LoanMappingHealthMonitor {
  constructor() {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retryCount: 0,
      averageResponseTime: 0,
      lastFailure: null,
      consecutiveFailures: 0
    };
  }

  /**
   * Record operation metrics
   */
  recordOperation(success, duration, error = null) {
    this.metrics.totalOperations++;
    
    if (success) {
      this.metrics.successfulOperations++;
      this.metrics.consecutiveFailures = 0;
    } else {
      this.metrics.failedOperations++;
      this.metrics.consecutiveFailures++;
      this.metrics.lastFailure = {
        timestamp: new Date(),
        error: error?.message || 'Unknown error',
        stack: error?.stack
      };
    }
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalOperations - 1) + duration) / 
      this.metrics.totalOperations;
    
    // Check if alerts should be triggered
    this.checkHealthAlerts();
  }

  /**
   * Record retry attempt
   */
  recordRetry() {
    this.metrics.retryCount++;
  }

  /**
   * Check for health alerts
   */
  checkHealthAlerts() {
    const failureRate = this.metrics.failedOperations / this.metrics.totalOperations;
    
    // Alert if failure rate exceeds 10%
    if (this.metrics.totalOperations >= 10 && failureRate > 0.1) {
      logger.warn('🚨 HIGH FAILURE RATE ALERT', {
        failureRate: `${(failureRate * 100).toFixed(2)}%`,
        totalOperations: this.metrics.totalOperations,
        failedOperations: this.metrics.failedOperations,
        consecutiveFailures: this.metrics.consecutiveFailures
      });
    }
    
    // Alert if consecutive failures exceed threshold
    if (this.metrics.consecutiveFailures >= 3) {
      logger.error('🚨 CONSECUTIVE FAILURES ALERT', {
        consecutiveFailures: this.metrics.consecutiveFailures,
        lastFailure: this.metrics.lastFailure
      });
    }
    
    // Alert if average response time is too high
    if (this.metrics.averageResponseTime > 5000) { // 5 seconds
      logger.warn('🚨 HIGH RESPONSE TIME ALERT', {
        averageResponseTime: `${this.metrics.averageResponseTime}ms`,
        totalOperations: this.metrics.totalOperations
      });
    }
  }

  /**
   * Get current health metrics
   */
  getMetrics() {
    const successRate = this.metrics.totalOperations > 0 ? 
      (this.metrics.successfulOperations / this.metrics.totalOperations) * 100 : 0;
    
    return {
      ...this.metrics,
      successRate: `${successRate.toFixed(2)}%`,
      health: successRate > 90 ? 'HEALTHY' : successRate > 70 ? 'WARNING' : 'CRITICAL'
    };
  }

  /**
   * Perform health check on loan mapping system
   */
  async performHealthCheck() {
    const startTime = Date.now();
    
    try {
      // Test database connectivity and basic operations
      const testCount = await LoanMapping.countDocuments();
      const duration = Date.now() - startTime;
      
      logger.info('✅ Loan mapping health check passed', {
        totalMappings: testCount,
        responseTime: `${duration}ms`,
        metrics: this.getMetrics()
      });
      
      this.recordOperation(true, duration);
      return { success: true, duration, totalMappings: testCount };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('❌ Loan mapping health check failed', {
        error: error.message,
        responseTime: `${duration}ms`,
        metrics: this.getMetrics()
      });
      
      this.recordOperation(false, duration, error);
      return { success: false, duration, error: error.message };
    }
  }

  /**
   * Check for orphaned or inconsistent data
   */
  async checkDataConsistency() {
    try {
      // Find mappings without required fields
      const inconsistentMappings = await LoanMapping.find({
        $or: [
          { essApplicationNumber: { $exists: false } },
          { essApplicationNumber: null },
          { essApplicationNumber: "" },
          { requestedAmount: { $exists: false } },
          { requestedAmount: null },
          { productCode: { $exists: false } },
          { productCode: null }
        ]
      }).limit(10);

      if (inconsistentMappings.length > 0) {
        logger.warn('🚨 DATA CONSISTENCY ALERT', {
          inconsistentCount: inconsistentMappings.length,
          sampleMappings: inconsistentMappings.map(m => ({
            id: m._id,
            applicationNumber: m.essApplicationNumber,
            status: m.status,
            createdAt: m.createdAt
          }))
        });
      }

      // Find mappings with old status values
      const oldStatusMappings = await LoanMapping.find({
        status: { $nin: ['INITIAL_OFFER', 'INITIAL_APPROVAL_SENT', 'APPROVED', 'REJECTED', 'CANCELLED', 'FINAL_APPROVAL_RECEIVED', 'CLIENT_CREATED', 'LOAN_CREATED', 'DISBURSED', 'FAILED', 'OFFER_SUBMITTED'] }
      }).limit(5);

      if (oldStatusMappings.length > 0) {
        logger.warn('🚨 INVALID STATUS ALERT', {
          invalidStatusCount: oldStatusMappings.length,
          sampleStatuses: oldStatusMappings.map(m => ({ id: m._id, status: m.status }))
        });
      }

      return {
        inconsistentMappings: inconsistentMappings.length,
        invalidStatusMappings: oldStatusMappings.length
      };
    } catch (error) {
      logger.error('❌ Data consistency check failed:', error);
      throw error;
    }
  }

  /**
   * Reset metrics (useful for testing or periodic resets)
   */
  resetMetrics() {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retryCount: 0,
      averageResponseTime: 0,
      lastFailure: null,
      consecutiveFailures: 0
    };
    logger.info('📊 Health monitor metrics reset');
  }
}

// Singleton instance
const healthMonitor = new LoanMappingHealthMonitor();

module.exports = healthMonitor;