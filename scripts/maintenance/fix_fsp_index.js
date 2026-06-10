const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/miracore', { 
  serverSelectionTimeoutMS: 5000 
})
.then(async () => {
  console.log('Connected to MongoDB\n');
  
  const db = mongoose.connection.db;
  const collection = db.collection('loanmappings');
  
  // Get existing indexes
  const indexes = await collection.indexes();
  console.log('Current indexes:');
  indexes.forEach(idx => {
    console.log(' -', idx.name, ':', JSON.stringify(idx.key), idx.unique ? '(UNIQUE)' : '');
  });
  
  // Check if fspReferenceNumber has unique index
  const fspIndex = indexes.find(idx => 
    idx.key.fspReferenceNumber && idx.unique
  );
  
  if (fspIndex) {
    console.log('\n⚠️  Found UNIQUE index on fspReferenceNumber:', fspIndex.name);
    console.log('Dropping unique index...');
    
    await collection.dropIndex(fspIndex.name);
    console.log('✅ Unique index dropped');
    
    // Create non-unique index
    console.log('\nCreating non-unique index...');
    await collection.createIndex({ fspReferenceNumber: 1 });
    console.log('✅ Non-unique index created');
  } else {
    console.log('\n✅ No unique index found on fspReferenceNumber');
  }
  
  // Show final indexes
  const finalIndexes = await collection.indexes();
  console.log('\nFinal indexes:');
  finalIndexes.forEach(idx => {
    console.log(' -', idx.name, ':', JSON.stringify(idx.key), idx.unique ? '(UNIQUE)' : '');
  });
  
  mongoose.connection.close();
  console.log('\nDone!');
  process.exit(0);
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
