const logger = require('../utils/logger');
const axios = require("axios");
const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs')
const https = require('https');
const { createMifosCircuitBreaker, getCircuitBreakerHealth } = require('../config/circuitBreaker');

const CBS_MAKER_USERNAME = process.env.CBS_MAKER_USERNAME;
const CBS_MAKER_PASSWORD = process.env.CBS_MAKER_PASSWORD;
const CBS_Tenant = process.env.CBS_Tenant;

// Connection pool configuration for better performance
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000
});

// Circuit breaker instances for different API clients
let makerCircuitBreaker = null;
let checkerCircuitBreaker = null;

const maker = axios.create({
  baseURL: process.env.CBS_BASE_URL,
  timeout: 60000,
  httpsAgent,
  headers: {
    'Content-Type': 'application/json',
    'Mifos-Platform-TenantId': CBS_Tenant
  }
});

maker.interceptors.request.use(
  async (config) => {
    try {
      // Get basic auth headers
      const authHeaders = { 'Authorization': `Basic ${Buffer.from(`${CBS_MAKER_USERNAME}:${CBS_MAKER_PASSWORD}`).toString('base64')}` };
      if (authHeaders.Authorization) {
        config.headers.Authorization = authHeaders.Authorization;
      }
      
      // Log request with correlation ID
      const correlationId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      config.headers['X-Correlation-ID'] = correlationId;
      
      logger.info('��� CBS API Request:', {
        correlationId,
        url: config.url,
        method: config.method,
        headers: {
          ...config.headers,
          Authorization: '[REDACTED]'
        }
      });
      
      return config;
    } catch (error) {
      logger.error('Request interceptor error:', error);
      throw error;
    }
  },
  (error) => {
    logger.error('Request interceptor rejection:', error);
    return Promise.reject(error);
  }
);

maker.interceptors.response.use(
  (response) => {
    const responseTime = response.config.metadata?.endTime - response.config.metadata?.startTime || 0;
    logger.info('��� CBS API Response:', {
      correlationId: response.config.headers['X-Correlation-ID'],
      status: response.status,
      responseTime: `${responseTime}ms`,
      url: response.config.url
    });
    return response;
  },
  (error) => {
    const responseTime = error.config?.metadata?.endTime - error.config?.metadata?.startTime || 0;
    
    const errorInfo = { shouldRetry: error.code === 'ECONNRESET' || error.code === 'TIMEOUT', category: 'network' };
    
    if (errorInfo.shouldRetry && error.config && !error.config.__isRetryRequest) {
      error.config.__retryCount = error.config.__retryCount || 0;
      if (error.config.__retryCount < 3) {
        error.config.__retryCount++;
        error.config.__isRetryRequest = true;
        
        const delay = Math.min(1000 * Math.pow(2, error.config.__retryCount), 10000);
        logger.warn(`Retrying CBS request (${error.config.__retryCount}/3) after ${delay}ms...`);
        
        return new Promise((resolve) => {
          setTimeout(() => resolve(maker(error.config)), delay);
        });
      }
    }
    
    logger.error('CBS API Error:', {
      correlationId: error.config?.headers?.['X-Correlation-ID'],
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      responseTime: `${responseTime}ms`
    });
    
    return Promise.reject(error);
  }
);

const checker = axios.create({
  baseURL: process.env.CBS_BASE_URL,
  timeout: 60000,
  httpsAgent,
  headers: {
    'Content-Type': 'application/json',
    'Mifos-Platform-TenantId': CBS_Tenant,
    'Authorization': `Basic ${Buffer.from(`${process.env.CBS_CHECKER_USERNAME}:${process.env.CBS_CHECKER_PASSWORD}`).toString('base64')}`
  }
});

/**
 * Wrap axios client request method with circuit breaker
 * 
 * @param {Object} axiosInstance - The axios instance to wrap
 * @param {String} name - Name for the circuit breaker (maker/checker)
 * @returns {Object} Wrapped axios instance with circuit breaker
 */
function wrapWithCircuitBreaker(axiosInstance, name) {
  const originalRequest = axiosInstance.request.bind(axiosInstance);
  const originalGet = axiosInstance.get.bind(axiosInstance);
  const originalPost = axiosInstance.post.bind(axiosInstance);
  const originalPut = axiosInstance.put.bind(axiosInstance);
  const originalPatch = axiosInstance.patch.bind(axiosInstance);
  const originalDelete = axiosInstance.delete.bind(axiosInstance);
  
  // Create circuit breakers for each HTTP method
  const requestBreaker = createMifosCircuitBreaker(
    async (config) => originalRequest(config),
    { name: `${name}-request` }
  );
  
  const getBreaker = createMifosCircuitBreaker(
    async (url, config) => originalGet(url, config),
    { name: `${name}-get` }
  );
  
  const postBreaker = createMifosCircuitBreaker(
    async (url, data, config) => originalPost(url, data, config),
    { name: `${name}-post` }
  );
  
  const putBreaker = createMifosCircuitBreaker(
    async (url, data, config) => originalPut(url, data, config),
    { name: `${name}-put` }
  );
  
  const patchBreaker = createMifosCircuitBreaker(
    async (url, data, config) => originalPatch(url, data, config),
    { name: `${name}-patch` }
  );
  
  const deleteBreaker = createMifosCircuitBreaker(
    async (url, config) => originalDelete(url, config),
    { name: `${name}-delete` }
  );
  
  // Override methods with circuit breaker wrapped versions
  axiosInstance.request = async (config) => requestBreaker.fire(config);
  axiosInstance.get = async (url, config) => getBreaker.fire(url, config);
  axiosInstance.post = async (url, data, config) => postBreaker.fire(url, data, config);
  axiosInstance.put = async (url, data, config) => putBreaker.fire(url, data, config);
  axiosInstance.patch = async (url, data, config) => patchBreaker.fire(url, data, config);
  axiosInstance.delete = async (url, config) => deleteBreaker.fire(url, config);
  
  // Store circuit breakers for health monitoring
  axiosInstance._circuitBreakers = {
    request: requestBreaker,
    get: getBreaker,
    post: postBreaker,
    put: putBreaker,
    patch: patchBreaker,
    delete: deleteBreaker
  };
  
  return axiosInstance;
}

// Wrap both maker and checker with circuit breakers
const makerWithCircuitBreaker = wrapWithCircuitBreaker(maker, 'MIFOS-Maker');
const checkerWithCircuitBreaker = wrapWithCircuitBreaker(checker, 'MIFOS-Checker');

/**
 * Get health status for all circuit breakers
 * 
 * @returns {Object} Circuit breaker health status
 */
function getCircuitBreakerStatus() {
  const makerHealth = {};
  const checkerHealth = {};
  
  // Get health for all maker circuit breakers
  if (makerWithCircuitBreaker._circuitBreakers) {
    Object.keys(makerWithCircuitBreaker._circuitBreakers).forEach(method => {
      makerHealth[method] = getCircuitBreakerHealth(makerWithCircuitBreaker._circuitBreakers[method]);
    });
  }
  
  // Get health for all checker circuit breakers
  if (checkerWithCircuitBreaker._circuitBreakers) {
    Object.keys(checkerWithCircuitBreaker._circuitBreakers).forEach(method => {
      checkerHealth[method] = getCircuitBreakerHealth(checkerWithCircuitBreaker._circuitBreakers[method]);
    });
  }
  
  return {
    maker: makerHealth,
    checker: checkerHealth,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  maker: makerWithCircuitBreaker,
  checker: checkerWithCircuitBreaker,
  getCircuitBreakerStatus,
  getHealthStatus: () => ({ 
    status: 'healthy', 
    services: [],
    circuitBreakers: getCircuitBreakerStatus()
  }),
  clearTokenCache: () => { /* Token cache cleared */ }
};
