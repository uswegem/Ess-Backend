/**
 * Circuit Breaker Configuration for MIFOS API Calls
 * 
 * Implements the circuit breaker pattern to prevent cascading failures
 * when MIFOS is down or experiencing issues.
 * 
 * Circuit Breaker States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: MIFOS is failing, requests fail fast
 * - HALF_OPEN: Testing if MIFOS has recovered
 */

const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');

/**
 * Circuit Breaker Options Configuration
 * 
 * @see https://nodeshift.dev/opossum/
 */
const circuitBreakerOptions = {
  // Request timeout in milliseconds
  // If MIFOS doesn't respond within 30s, consider it a failure
  timeout: 30000, // 30 seconds
  
  // Error threshold percentage (0-1)
  // If 50% of requests fail, open the circuit
  errorThresholdPercentage: 50,
  
  // Reset timeout in milliseconds
  // After 60s in OPEN state, try HALF_OPEN to test recovery
  resetTimeout: 60000, // 60 seconds
  
  // Rolling count timeout in milliseconds
  // Track errors over a 60s window
  rollingCountTimeout: 60000,
  
  // Rolling count buckets
  // Divide the 60s window into 10 buckets of 6s each
  rollingCountBuckets: 10,
  
  // Name for monitoring
  name: 'MIFOS-API-CircuitBreaker',
  
  // Capacity of the rolling percentile window
  rollingPercentilesEnabled: true,
  
  // Enable/disable the circuit breaker
  enabled: true,
  
  // Volume threshold
  // Minimum number of requests in rolling window before opening circuit
  volumeThreshold: 5,
  
  // Enable request caching (disabled for now)
  cache: false,
  
  // Error filter - define what constitutes an error
  errorFilter: (err) => {
    // Don't count 4xx client errors as circuit breaker failures
    if (err.response && err.response.status >= 400 && err.response.status < 500) {
      // Except for 408 (timeout), 429 (rate limit), which indicate service issues
      if (err.response.status === 408 || err.response.status === 429) {
        return true; // Count as failure
      }
      return false; // Don't count as failure
    }
    // Count all other errors (5xx, network, timeout) as failures
    return true;
  }
};

/**
 * Fallback function when circuit is OPEN
 * Returns a service unavailable response
 */
const fallbackFunction = (error) => {
  logger.warn('Circuit breaker OPEN - MIFOS is unavailable', {
    error: error.message,
    action: 'fallback'
  });
  
  const err = new Error('MIFOS service temporarily unavailable. Please try again later.');
  err.code = 'SERVICE_UNAVAILABLE';
  err.statusCode = 503;
  err.retryAfter = 60; // Suggest retry after 60 seconds
  err.originalError = error.message;
  throw err;
};

/**
 * Create a circuit breaker for MIFOS API calls
 * 
 * @param {Function} asyncFunction - The async function to wrap
 * @param {Object} options - Optional overrides for circuit breaker options
 * @returns {CircuitBreaker} Configured circuit breaker instance
 */
function createMifosCircuitBreaker(asyncFunction, options = {}) {
  const breaker = new CircuitBreaker(asyncFunction, {
    ...circuitBreakerOptions,
    ...options
  });
  
  // Register event handlers
  setupEventHandlers(breaker);
  
  // Set fallback
  breaker.fallback(fallbackFunction);
  
  return breaker;
}

/**
 * Setup event handlers for circuit breaker monitoring
 * 
 * @param {CircuitBreaker} breaker - The circuit breaker instance
 */
function setupEventHandlers(breaker) {
  // Circuit opened - MIFOS is failing
  breaker.on('open', () => {
    logger.error('🔴 Circuit breaker OPENED - MIFOS API is failing', {
      stats: breaker.stats,
      state: 'OPEN',
      action: 'circuit_opened'
    });
  });
  
  // Circuit closed - MIFOS has recovered
  breaker.on('close', () => {
    logger.info('🟢 Circuit breaker CLOSED - MIFOS API recovered', {
      stats: breaker.stats,
      state: 'CLOSED',
      action: 'circuit_closed'
    });
  });
  
  // Circuit half-open - testing recovery
  breaker.on('halfOpen', () => {
    logger.warn('🟡 Circuit breaker HALF-OPEN - Testing MIFOS recovery', {
      state: 'HALF_OPEN',
      action: 'circuit_testing'
    });
  });
  
  // Fallback executed
  breaker.on('fallback', (result) => {
    logger.warn('Circuit breaker fallback executed', {
      action: 'fallback_executed'
    });
  });
  
  // Request succeeded
  breaker.on('success', (result, latency) => {
    logger.debug('MIFOS request succeeded', {
      latency: `${latency}ms`,
      action: 'request_success'
    });
  });
  
  // Request failed
  breaker.on('failure', (error) => {
    logger.warn('MIFOS request failed', {
      error: error.message,
      action: 'request_failure'
    });
  });
  
  // Request timed out
  breaker.on('timeout', () => {
    logger.warn('MIFOS request timed out', {
      timeout: `${circuitBreakerOptions.timeout}ms`,
      action: 'request_timeout'
    });
  });
  
  // Request rejected (circuit is open)
  breaker.on('reject', () => {
    logger.warn('MIFOS request rejected - circuit is OPEN', {
      action: 'request_rejected'
    });
  });
  
  // Health check snapshot (every 5 seconds)
  breaker.on('snapshot', (snapshot) => {
    logger.debug('Circuit breaker health snapshot', {
      stats: snapshot,
      action: 'health_snapshot'
    });
  });
}

/**
 * Get circuit breaker health status
 * 
 * @param {CircuitBreaker} breaker - The circuit breaker instance
 * @returns {Object} Health status object
 */
function getCircuitBreakerHealth(breaker) {
  if (!breaker) {
    return {
      enabled: false,
      state: 'N/A',
      stats: null
    };
  }
  
  const stats = breaker.stats;
  const isOpen = breaker.opened;
  const isPendingClose = breaker.pendingClose;
  
  return {
    enabled: breaker.enabled,
    state: isOpen ? 'OPEN' : (isPendingClose ? 'HALF_OPEN' : 'CLOSED'),
    name: breaker.name,
    stats: {
      fires: stats.fires,
      successes: stats.successes,
      failures: stats.failures,
      rejects: stats.rejects,
      timeouts: stats.timeouts,
      fallbacks: stats.fallbacks,
      semaphoreRejections: stats.semaphoreRejections,
      percentiles: stats.percentiles,
      latencyMean: stats.latencyMean,
      errorRate: ((stats.failures + stats.timeouts) / stats.fires * 100).toFixed(2) + '%'
    },
    options: {
      timeout: breaker.options.timeout,
      errorThresholdPercentage: breaker.options.errorThresholdPercentage,
      resetTimeout: breaker.options.resetTimeout,
      volumeThreshold: breaker.options.volumeThreshold
    }
  };
}

module.exports = {
  createMifosCircuitBreaker,
  circuitBreakerOptions,
  getCircuitBreakerHealth,
  setupEventHandlers
};
