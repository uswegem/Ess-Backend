const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Setup before all tests
beforeAll(async () => {
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
