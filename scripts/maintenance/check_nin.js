const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');

mongoose.connect('mongodb://localhost:27017/miracore', { serverSelectionTimeoutMS: 5000 })
.then(async () => {
  const mapping = await LoanMapping.findOne({ essApplicationNumber: 'ESS1766006882463' });
  
  if (!mapping) {
    console.log('Application not found');
    process.exit(1);
  }
  
  console.log('\n=== NIN DATA CHECK ===\n');
  console.log('Application:', mapping.essApplicationNumber);
  console.log('\nClient Data NIN:', mapping.clientData?.nin || 'MISSING');
  console.log('Metadata Client NIN:', mapping.metadata?.clientData?.nin || 'MISSING');
  
  console.log('\n=== FULL CLIENT DATA ===');
  console.log(JSON.stringify(mapping.clientData, null, 2));
  
  console.log('\n=== FULL METADATA ===');
  console.log(JSON.stringify(mapping.metadata?.clientData, null, 2));
  
  mongoose.connection.close();
  process.exit(0);
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
