const mongoose = require('mongoose');
const logger = require('../utils/logger');

let fallbackMongoServer = null;

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
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const options = {
    maxPoolSize: 50,
    minPoolSize: 10,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 10000,
  };

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore';

  try {
    const conn = await mongoose.connect(uri, options);
    logger.info(`MongoDB Connected: ${conn.connection.host}`, {
      database: conn.connection.name,
      poolSize: options.maxPoolSize,
    });
    await createInitialSuperAdmin();
    return conn;
  } catch (error) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MONGO_FALLBACK !== 'true') {
      logger.error('MongoDB connection error', { error: error.message, stack: error.stack });
      throw error;
    }

    logger.warn('MongoDB host unavailable, starting embedded MongoMemoryServer fallback', {
      uri,
      error: error.message,
    });

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      fallbackMongoServer = await MongoMemoryServer.create();
      const fallbackUri = fallbackMongoServer.getUri();
      const conn = await mongoose.connect(fallbackUri, options);

      logger.info('Embedded MongoMemoryServer connected', {
        host: conn.connection.host,
        database: conn.connection.name,
      });

      await createInitialSuperAdmin();
      return conn;
    } catch (fallbackError) {
      logger.error('Failed to connect to MongoDB and fallback server', {
        error: fallbackError.message,
        stack: fallbackError.stack,
      });
      throw fallbackError;
    }
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