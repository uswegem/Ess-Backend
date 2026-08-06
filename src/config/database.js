const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Enable query performance monitoring for development
if (process.env.NODE_ENV === 'development') {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    logger.debug('Mongoose Query', {
      collection: collectionName,
      method,
      query,
      doc: doc ? 'present' : 'none'
    });
  });
}

const connectDB = async () => {
  try {
    // Optimized connection options for production
    const options = {
      maxPoolSize: 50,              // Up from default 5 - better concurrent handling
      minPoolSize: 10,              // Maintain minimum connections
      socketTimeoutMS: 45000,       // Socket timeout
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000   // Health check frequency
    };

    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore',
      options
    );

    logger.info(`MongoDB Connected: ${conn.connection.host}`, {
      database: conn.connection.name,
      poolSize: options.maxPoolSize
    });
    
    // Create initial super admin if doesn't exist
    await createInitialSuperAdmin();
    
  } catch (error) {
    logger.error('MongoDB connection error', { error: error.message, stack: error.stack });
    logger.info('Continuing without database connection for testing...');
    // process.exit(1); // Commented out for testing
  }
};

const createInitialSuperAdmin = async () => {
  try {
    const User = require('../models/User');
    const superAdminExists = await User.findOne({ role: 'super_admin' });
    
    if (!superAdminExists) {
      const superAdmin = new User({
        username: 'superadmin',
        email: 'superadmin@emkopo.tz',
        password: 'SuperAdmin123!', // Will be hashed by pre-save hook
        role: 'super_admin',
        fullName: 'System Super Administrator',
        phone: '+255000000000'
      });
      
      await superAdmin.save();
      logger.info('Initial Super Admin created', {
        username: 'superadmin',
        note: 'Change default password immediately!'
      });
    }
  } catch (error) {
    logger.error('Error creating initial super admin', { error: error.message });
  }
};

module.exports = connectDB;