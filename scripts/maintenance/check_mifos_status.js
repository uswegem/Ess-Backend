const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');

mongoose.connect('mongodb://localhost:27017/miracore', { serverSelectionTimeoutMS: 5000 })
.then(async () => {
  const mapping = await LoanMapping.findOne({ essApplicationNumber: 'ESS1766006882463' });
  
  if (!mapping) {
    console.log('Application not found');
    process.exit(1);
  }
  
  console.log('\n=== APPLICATION: ESS1766006882463 ===\n');
  console.log('Status:', mapping.status);
  console.log('\nMifos Client:');
  console.log('  Client ID:', mapping.mifosClientId || 'NOT CREATED');
  console.log('\nMifos Loan:');
  console.log('  Loan ID:', mapping.mifosLoanId || 'NOT CREATED');
  console.log('  Account No:', mapping.mifosLoanAccountNo || 'N/A');
  console.log('\nLoan Details:');
  console.log('  Requested:', mapping.requestedAmount, 'TZS');
  console.log('  Tenure:', mapping.tenure, 'months');
  
  mongoose.connection.close();
  process.exit(0);
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
