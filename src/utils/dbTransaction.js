const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Database transaction utility for ensuring atomicity
 */
class DBTransaction {
  /**
   * Execute a database operation within a transaction
   * @param {Function} operation - Async function that performs database operations
   * @param {Object} options - Transaction options
   * @returns {Promise<any>} - Result of the operation
   */
  static async execute(operation, options = {}) {
    // Check if MongoDB is running in replica set mode
    const isReplicaSet = mongoose.connection.db && 
                         mongoose.connection.db.serverConfig && 
                         mongoose.connection.db.serverConfig.s && 
                         mongoose.connection.db.serverConfig.s.description && 
                         mongoose.connection.db.serverConfig.s.description.type !== 'Standalone';
    
    if (!isReplicaSet) {
      // Run without transaction for standalone MongoDB
      logger.info('🔄 Executing database operation (standalone mode - no transaction)');
      try {
        const result = await operation(null);
        logger.info('✅ Database operation completed successfully');
        return result;
      } catch (error) {
        logger.error('❌ Database operation failed:', {
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    }
    
    // Use transactions for replica set
    const session = await mongoose.startSession();
    
    try {
      let result;
      
      await session.withTransaction(async () => {
        logger.info('🔄 Starting database transaction (replica set mode)');
        result = await operation(session);
        logger.info('✅ Database transaction completed successfully');
      }, {
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' },
        ...options
      });
      
      return result;
    } catch (error) {
      logger.error('❌ Database transaction failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Execute with retry logic
   * @param {Function} operation - Async function that performs database operations
   * @param {Object} options - Options including retry config
   * @returns {Promise<any>} - Result of the operation
   */
  static async executeWithRetry(operation, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
      ...transactionOptions
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`🔄 Database operation attempt ${attempt}/${maxRetries}`);
        return await this.execute(operation, transactionOptions);
      } catch (error) {
        lastError = error;
        
        // Don't retry validation errors or non-retryable errors
        if (this.isNonRetryableError(error)) {
          logger.error('❌ Non-retryable error detected, aborting retry attempts:', error.message);
          throw error;
        }
        
        if (attempt === maxRetries) {
          logger.error(`❌ All ${maxRetries} retry attempts failed`);
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
        logger.warn(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Check if an error should not be retried
   * @param {Error} error - The error to check
   * @returns {boolean} - True if error is non-retryable
   */
  static isNonRetryableError(error) {
    // Validation errors should not be retried
    if (error.name === 'ValidationError') return true;
    if (error.name === 'CastError') return true;
    if (error.code === 11000) return true; // Duplicate key error
    
    // Schema-related errors
    if (error.message && error.message.includes('is not a valid enum')) return true;
    if (error.message && error.message.includes('is required')) return true;
    
    return false;
  }
}

module.exports = DBTransaction;