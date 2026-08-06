const logger = require('../utils/logger');

/**
 * MIFOS Request Manager
 * Handles rate limiting, request queuing, and batch operations
 */
class MifosRequestManager {
    constructor() {
        this.requestQueue = [];
        this.activeRequests = 0;
        this.maxConcurrentRequests = 5;
        this.rateLimitConfig = {
            maxRequestsPerMinute: 100,
            requestWindow: 60000, // 1 minute
            requestTimestamps: []
        };
        this.batchOperations = new Map();
        this.isProcessing = false;
        
        // Start queue processor
        this.startQueueProcessor();
    }

    /**
     * Queue a request for processing with rate limiting
     */
    async queueRequest(requestConfig, priority = 'normal') {
        return new Promise((resolve, reject) => {
            const queueItem = {
                id: this.generateRequestId(),
                config: requestConfig,
                priority,
                resolve,
                reject,
                timestamp: Date.now(),
                retryCount: 0
            };

            // Insert based on priority
            if (priority === 'high') {
                this.requestQueue.unshift(queueItem);
            } else {
                this.requestQueue.push(queueItem);
            }

            logger.info(`📥 Queued MIFOS request: ${queueItem.id} (${priority} priority)`);
            this.processQueue();
        });
    }

    /**
     * Process queued requests with rate limiting
     */
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.requestQueue.length > 0 && this.canMakeRequest()) {
            const queueItem = this.requestQueue.shift();
            
            if (this.activeRequests < this.maxConcurrentRequests) {
                this.executeRequest(queueItem);
            } else {
                // Put back at front of queue
                this.requestQueue.unshift(queueItem);
                break;
            }
        }

        this.isProcessing = false;
    }

    /**
     * Check if we can make a request based on rate limits
     */
    canMakeRequest() {
        const now = Date.now();
        const windowStart = now - this.rateLimitConfig.requestWindow;
        
        // Clean old timestamps
        this.rateLimitConfig.requestTimestamps = this.rateLimitConfig.requestTimestamps
            .filter(timestamp => timestamp > windowStart);
        
        return this.rateLimitConfig.requestTimestamps.length < this.rateLimitConfig.maxRequestsPerMinute;
    }

    /**
     * Execute individual request
     */
    async executeRequest(queueItem) {
        this.activeRequests++;
        this.rateLimitConfig.requestTimestamps.push(Date.now());

        try {
            const { maker: cbsApi } = require('./cbs.api');
            const startTime = Date.now();
            
            logger.info(`🚀 Executing MIFOS request: ${queueItem.id}`);
            
            const response = await cbsApi(queueItem.config);
            const duration = Date.now() - startTime;
            
            logger.info(`✅ MIFOS request completed: ${queueItem.id} (${duration}ms)`);
            queueItem.resolve(response);
            
        } catch (error) {
            logger.error(`❌ MIFOS request failed: ${queueItem.id}`, error.message);
            
            // Retry logic for failed requests
            if (this.shouldRetry(queueItem, error)) {
                queueItem.retryCount++;
                queueItem.timestamp = Date.now() + this.getRetryDelay(queueItem.retryCount);
                
                // Re-queue with delay
                setTimeout(() => {
                    this.requestQueue.unshift(queueItem);
                    this.processQueue();
                }, this.getRetryDelay(queueItem.retryCount));
                
                logger.info(`🔄 Retrying MIFOS request: ${queueItem.id} (attempt ${queueItem.retryCount})`);
            } else {
                queueItem.reject(error);
            }
        } finally {
            this.activeRequests--;
            
            // Continue processing queue
            setTimeout(() => this.processQueue(), 100);
        }
    }

    /**
     * Check if request should be retried
     */
    shouldRetry(queueItem, error) {
        const maxRetries = 3;
        const retryableErrors = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNABORTED'];
        
        return queueItem.retryCount < maxRetries && 
               (retryableErrors.includes(error.code) || 
                (error.response && error.response.status >= 500));
    }

    /**
     * Get retry delay with exponential backoff
     */
    getRetryDelay(retryCount) {
        return Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
    }

    /**
     * Batch multiple similar operations
     */
    async batchOperation(operationType, items, batchSize = 5) {
        const batches = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }

        logger.info(`📦 Processing ${items.length} ${operationType} operations in ${batches.length} batches`);

        const results = [];
        for (const batch of batches) {
            const batchPromises = batch.map(item => 
                this.queueRequest(item.config, item.priority || 'normal')
            );
            
            try {
                const batchResults = await Promise.allSettled(batchPromises);
                results.push(...batchResults);
                
                // Small delay between batches to avoid overwhelming MIFOS
                if (batches.indexOf(batch) < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                logger.error(`❌ Batch ${operationType} failed:`, error);
                throw error;
            }
        }

        return results;
    }

    /**
     * Get queue statistics
     */
    getQueueStats() {
        const now = Date.now();
        const recentRequests = this.rateLimitConfig.requestTimestamps
            .filter(timestamp => timestamp > now - this.rateLimitConfig.requestWindow).length;

        return {
            queueLength: this.requestQueue.length,
            activeRequests: this.activeRequests,
            recentRequests,
            rateLimitUtilization: `${recentRequests}/${this.rateLimitConfig.maxRequestsPerMinute}`,
            maxConcurrent: this.maxConcurrentRequests,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Start automatic queue processor
     */
    startQueueProcessor() {
        setInterval(() => {
            if (this.requestQueue.length > 0) {
                this.processQueue();
            }
        }, 1000);
        
        logger.info('🚀 MIFOS request queue processor started');
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Update rate limit configuration
     */
    updateRateLimit(maxRequestsPerMinute, maxConcurrentRequests) {
        this.rateLimitConfig.maxRequestsPerMinute = maxRequestsPerMinute;
        this.maxConcurrentRequests = maxConcurrentRequests;
        
        logger.info(`⚙️ Updated rate limits: ${maxRequestsPerMinute}/min, ${maxConcurrentRequests} concurrent`);
    }
}

// Singleton instance
const requestManager = new MifosRequestManager();

module.exports = requestManager;