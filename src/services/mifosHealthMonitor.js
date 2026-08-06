const logger = require('../utils/logger');
const { maker: cbsApi } = require('./cbs.api');

/**
 * MIFOS Health Monitor
 * Monitors MIFOS connectivity, performance, and availability
 */
class MifosHealthMonitor {
    constructor() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastHealthCheck: null,
            isHealthy: true,
            lastError: null,
            responseTimeHistory: []
        };
        
        // Start periodic health checks
        this.startHealthChecks();
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const startTime = Date.now();
        
        try {
            logger.info('🏥 Performing MIFOS health check...');

            // Test basic connectivity
            const response = await cbsApi.get('/v1/clients?limit=1');
            const responseTime = Date.now() - startTime;

            if (response.status) {
                this.metrics.isHealthy = true;
                this.metrics.lastHealthCheck = new Date().toISOString();
                this.updateResponseTimeMetrics(responseTime);
                
                logger.info(`✅ MIFOS health check passed (${responseTime}ms)`);
                return {
                    healthy: true,
                    responseTime,
                    timestamp: this.metrics.lastHealthCheck,
                    metrics: this.getHealthMetrics()
                };
            } else {
                throw new Error('Health check returned non-success status');
            }
        } catch (error) {
            this.metrics.isHealthy = false;
            this.metrics.lastError = {
                message: error.message,
                timestamp: new Date().toISOString()
            };
            
            logger.error('❌ MIFOS health check failed:', error.message);
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                metrics: this.getHealthMetrics()
            };
        }
    }

    /**
     * Update response time metrics
     */
    updateResponseTimeMetrics(responseTime) {
        this.metrics.responseTimeHistory.push(responseTime);
        
        // Keep only last 100 measurements
        if (this.metrics.responseTimeHistory.length > 100) {
            this.metrics.responseTimeHistory.shift();
        }
        
        // Calculate average response time
        const sum = this.metrics.responseTimeHistory.reduce((a, b) => a + b, 0);
        this.metrics.averageResponseTime = Math.round(sum / this.metrics.responseTimeHistory.length);
    }

    /**
     * Record API request metrics
     */
    recordRequest(success, responseTime = null) {
        this.metrics.totalRequests++;
        
        if (success) {
            this.metrics.successfulRequests++;
            if (responseTime) this.updateResponseTimeMetrics(responseTime);
        } else {
            this.metrics.failedRequests++;
        }
    }

    /**
     * Get current health metrics
     */
    getHealthMetrics() {
        const successRate = this.metrics.totalRequests > 0 
            ? ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(2)
            : 100;

        return {
            ...this.metrics,
            successRate: `${successRate}%`,
            uptime: this.calculateUptime()
        };
    }

    /**
     * Calculate system uptime
     */
    calculateUptime() {
        const uptimeMs = process.uptime() * 1000;
        const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    /**
     * Start periodic health checks
     */
    startHealthChecks() {
        // Initial health check
        setTimeout(() => this.performHealthCheck(), 5000);
        
        // Periodic health checks every 5 minutes
        setInterval(() => {
            this.performHealthCheck();
        }, 5 * 60 * 1000);
        
        logger.info('🚀 MIFOS health monitoring started');
    }

    /**
     * Get detailed system status
     */
    async getDetailedStatus() {
        try {
            // Test different endpoints to verify full functionality
            const tests = [
                { name: 'Client Search', endpoint: '/v1/clients?limit=1' },
                { name: 'Loan Products', endpoint: '/v1/loanproducts?limit=1' },
                { name: 'System Info', endpoint: '/v1/systeminfo' }
            ];

            const results = await Promise.allSettled(
                tests.map(async (test) => {
                    const startTime = Date.now();
                    try {
                        const response = await cbsApi.get(test.endpoint);
                        const responseTime = Date.now() - startTime;
                        return {
                            ...test,
                            status: 'success',
                            responseTime,
                            healthy: response.status
                        };
                    } catch (error) {
                        return {
                            ...test,
                            status: 'failed',
                            error: error.message,
                            healthy: false
                        };
                    }
                })
            );

            return {
                timestamp: new Date().toISOString(),
                overallHealth: this.metrics.isHealthy,
                tests: results.map(result => result.value),
                metrics: this.getHealthMetrics()
            };
        } catch (error) {
            logger.error('Failed to get detailed MIFOS status:', error);
            return {
                timestamp: new Date().toISOString(),
                overallHealth: false,
                error: error.message,
                metrics: this.getHealthMetrics()
            };
        }
    }
}

// Singleton instance
const healthMonitor = new MifosHealthMonitor();

module.exports = healthMonitor;