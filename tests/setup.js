const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  process.env.TENANT_SECRET_ENCRYPTION_KEY = process.env.TENANT_SECRET_ENCRYPTION_KEY || 'd'.repeat(64);
  process.env.LEGACY_TENANT_ID = process.env.LEGACY_TENANT_ID || 'legacy-zedone';
  process.env.TENANT_ENFORCEMENT = process.env.TENANT_ENFORCEMENT || 'false';
  process.env.NODE_ENV = 'test';

  // Start in-memory MongoDB server for tests
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect mongoose to the in-memory database
  await mongoose.connect(mongoUri);
  
  console.log('✅ In-memory MongoDB started for tests');
});

// Cleanup after all tests
afterAll(async () => {
  // Close mongoose connection
  await mongoose.disconnect();
  
  // Stop in-memory MongoDB server
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  console.log('✅ In-memory MongoDB stopped');
});

// Clear all collections between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
