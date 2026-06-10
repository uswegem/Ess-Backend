const axios = require('axios');
const https = require('https');
const logger = require('./logger');

/**
 * Utility for ensuring Utumishi connectivity before making requests
 */
class ConnectionValidator {
  constructor() {
    this.utumishiEndpoint = process.env.UTUMISHI_ENDPOINT || 'https://154.118.230.140';
    this.timeout = 5000; // 5 seconds
    this.maxRetries = 2;
    
    // Create axios instance for validation
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      headers: {
        'User-Agent': 'ESS-ConnectionValidator/1.0'
      }
    });
  }

  /**
   * Validate connection to Utumishi before making a request
   * @returns {Promise<boolean>} True if connection is valid
   */
  async validateConnection() {
    try {
      logger.info('Validating connection to Utumishi', { endpoint: this.utumishiEndpoint });
      
      const response = await this.axiosInstance.get(this.utumishiEndpoint, {
        timeout: this.timeout
      });
      
      logger.info('Connection validated successfully', { status: response.status });
      return true;
      
    } catch (error) {
      logger.warn('Connection validation failed', { error: error.message, endpoint: this.utumishiEndpoint });
      return false;
    }
  }

  /**
   * Ensure connection is available, with automatic reconnection attempt
   * @returns {Promise<boolean>} True if connection is ready
   */
  async ensureConnection() {
    logger.info('Ensuring Utumishi connectivity');
    
    // First, try to validate current connection
    const isValid = await this.validateConnection();
    
    if (isValid) {
      logger.info('Connection is already active');
      return true;
    }
    
    logger.warn('Connection appears down, attempting to re-establish');
    
    // Try manual IPSec reconnection
    logger.info('Attempting IPSec tunnel reconnection');
    
    try {
      await this.reconnectIPSecTunnel();
      
      // Wait for tunnel to establish
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const isValidAfterReconnect = await this.validateConnection();
      if (isValidAfterReconnect) {
        logger.info('Connection restored via IPSec reconnection');
        return true;
      }
    } catch (error) {
      logger.error('IPSec reconnection failed', { error: error.message });
    }
    
    logger.error('Failed to establish connection to Utumishi');
    return false;
  }

  /**
   * Attempt to reconnect IPSec tunnel
   * @returns {Promise<void>}
   */
  async reconnectIPSecTunnel() {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    logger.info('Reconnecting IPSec tunnel');
    
    try {
      // First, bring down existing tunnel
      logger.info('Bringing down existing tunnel');
      await execAsync('sudo ipsec down utumishi-tunnel', { timeout: 10000 });
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Bring up the tunnel
      logger.info('Bringing up tunnel');
      const { stdout, stderr } = await execAsync('sudo ipsec up utumishi-tunnel', { timeout: 15000 });
      
      if (stderr && stderr.includes('ERROR')) {
        throw new Error(`IPSec error: ${stderr}`);
      }
      
      logger.info('IPSec tunnel reconnection completed', { output: stdout });
      
    } catch (error) {
      logger.error('IPSec reconnection error', { error: error.message });
      throw error;
    }
  }

  /**
   * Enhanced request wrapper that ensures connection before sending
   * @param {Function} requestFn - Function that makes the actual request
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<any>} Request result
   */
  async requestWithEnsuredConnection(requestFn, retries = this.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      logger.info('Request attempt', { attempt, maxRetries: retries });
      
      // Ensure connection before making request
      const connectionReady = await this.ensureConnection();
      
      if (!connectionReady) {
        if (attempt === retries) {
          throw new Error('Unable to establish connection to Utumishi after all attempts');
        }
        logger.warn('Waiting before retry attempt', { nextAttempt: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      
      try {
        // Make the actual request
        logger.info('Making request to Utumishi');
        const result = await requestFn();
        
        logger.info('Request completed successfully');
        return result;
        
      } catch (error) {
        logger.error('Request failed', { attempt, error: error.message });
        
        if (attempt === retries) {
          throw error;
        }
        
        // Check if it's a network error that might benefit from reconnection
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
          logger.warn('Network error detected, will retry with connection validation', { errorCode: error.code });
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Get connection status
   * @returns {Promise<Object>} Connection status info
   */
  async getConnectionStatus() {
    const isValid = await this.validateConnection();
    
    return {
      isConnected: isValid,
      endpoint: this.utumishiEndpoint,
      lastValidated: new Date().toISOString()
    };
  }
}

// Export singleton instance
const connectionValidator = new ConnectionValidator();

module.exports = connectionValidator;