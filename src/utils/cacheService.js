const redis = require('redis');
const logger = require('./logger');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    // Skip Redis in test environment
    if (process.env.NODE_ENV === 'test') {
      this.isConnected = false;
      logger.info('Redis disabled in test environment');
      return;
    }

    // Skip Redis if no configuration provided (make it optional)
    if (!process.env.REDIS_HOST && !process.env.REDIS_URL) {
      this.isConnected = false;
      logger.info('Redis not configured, caching disabled');
      return;
    }

    try {
      const redisConfig = {};
      
      if (process.env.REDIS_URL) {
        redisConfig.url = process.env.REDIS_URL;
      } else {
        redisConfig.host = process.env.REDIS_HOST || 'localhost';
        redisConfig.port = parseInt(process.env.REDIS_PORT) || 6379;
        if (process.env.REDIS_PASSWORD) {
          redisConfig.password = process.env.REDIS_PASSWORD;
        }
      }

      redisConfig.retry_strategy = (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.warn('Redis connection refused, will retry...');
          // Return undefined to stop retrying after max attempts
          if (options.attempt > 3) {
            logger.error('Redis connection failed after max retries, disabling Redis');
            return undefined;
          }
          return Math.min(options.attempt * 1000, 5000);
        }
        if (options.total_retry_time > 1000 * 60 * 5) { // 5 minutes
          logger.error('Redis retry time exhausted, disabling Redis');
          return undefined;
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached, disabling Redis');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      };

      this.client = redis.createClient(redisConfig);

      this.client.on('connect', () => {
        logger.info('✅ Redis connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error('❌ Redis connection error:', {
          message: err.message,
          code: err.code,
          errno: err.errno
        });
        this.isConnected = false;
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis ready');
      });

      this.client.on('end', () => {
        logger.warn('Redis connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.warn('Redis initialization failed, caching disabled:', error.message);
      this.isConnected = false;
      this.client = null;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error:', error.message);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected) return false;

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Redis set error:', error.message);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis del error:', error.message);
      return false;
    }
  }

  async clear(pattern = '*') {
    if (!this.isConnected) return false;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      logger.error('Redis clear error:', error.message);
      return false;
    }
  }

  // Loan calculation specific caching
  async getLoanCalculation(key) {
    return this.get(`loan_calc:${key}`);
  }

  async setLoanCalculation(key, data, ttl = 1800) { // 30 minutes
    return this.set(`loan_calc:${key}`, data, ttl);
  }

  // Client data caching
  async getClientData(clientId) {
    return this.get(`client:${clientId}`);
  }

  async setClientData(clientId, data, ttl = 3600) { // 1 hour
    return this.set(`client:${clientId}`, data, ttl);
  }

  // API response caching
  async getApiResponse(endpoint, params) {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return this.get(key);
  }

  async setApiResponse(endpoint, params, data, ttl = 300) { // 5 minutes
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return this.set(key, data, ttl);
  }

  async close() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

module.exports = new CacheService();