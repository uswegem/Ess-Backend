require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// MIFOS API setup
const api = axios.create({
  baseURL: process.env.CBS_BASE_URL,
  timeout: 60000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    'Content-Type': 'application/json',
    'Mifos-Platform-TenantId': process.env.CBS_Tenant,
    'Authorization': 'Basic ' + Buffer.from(`${process.env.CBS_MAKER_USERNAME}:${process.env.CBS_MAKER_PASSWORD}`).toString('base64')
  }
});

async function clearAllData() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  DATABASE CLEANUP - START FRESH');
    console.log('='.repeat(80) + '\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore');
    console.log('✅ Connected to MongoDB\n');

    // Get loan mappings
    const LoanMapping = mongoose.model('LoanMapping', new mongoose.Schema({}, { strict: false, collection: 'loanmappings' }));
    const mappings = await LoanMapping.find({});
    
    console.log('📊 CURRENT DATA:');
    console.log('─'.repeat(80));
    console.log(`Total Loan Mappings: ${mappings.length}`);
    
    if (mappings.length > 0) {
      console.log('\nLoan Mappings to be deleted:');
      mappings.forEach((m, i) => {
        console.log(`${i + 1}. ${m.essApplicationNumber} - ${m.essLoanNumberAlias || 'N/A'} - Status: ${m.status}`);
        if (m.mifosClientId) console.log(`   MIFOS Client ID: ${m.mifosClientId}`);
        if (m.mifosLoanId) console.log(`   MIFOS Loan ID: ${m.mifosLoanId}`);
      });
    }

    // Get MIFOS data
    console.log('\n📊 Fetching MIFOS data...');
    const loansResponse = await api.get('/v1/loans');
    const clientsResponse = await api.get('/v1/clients');
    
    const loans = loansResponse.data?.pageItems || [];
    const clients = clientsResponse.data?.pageItems || [];
    
    console.log(`Total MIFOS Loans: ${loans.length}`);
    console.log(`Total MIFOS Clients: ${clients.length}`);
    
    if (loans.length > 0) {
      console.log('\nMIFOS Loans to be deleted:');
      loans.forEach((l, i) => {
        console.log(`${i + 1}. Loan ID: ${l.id} - Account: ${l.accountNo} - Client ID: ${l.clientId} - Status: ${l.status?.value}`);
      });
    }
    
    if (clients.length > 0) {
      console.log('\nMIFOS Clients to be deleted:');
      clients.forEach((c, i) => {
        console.log(`${i + 1}. Client ID: ${c.id} - ${c.displayName} - NIN: ${c.externalId || 'N/A'}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('⚠️  WARNING: THIS ACTION CANNOT BE UNDONE!');
    console.log('='.repeat(80));
    console.log('This will delete:');
    console.log(`  • ${mappings.length} loan mappings from MongoDB`);
    console.log(`  • ${loans.length} loans from MIFOS`);
    console.log(`  • ${clients.length} clients from MIFOS`);
    console.log('='.repeat(80) + '\n');

    const confirm1 = await question('Type "DELETE" to confirm deletion: ');
    if (confirm1 !== 'DELETE') {
      console.log('\n❌ Cleanup cancelled.\n');
      rl.close();
      process.exit(0);
    }

    const confirm2 = await question('Are you absolutely sure? Type "YES" to proceed: ');
    if (confirm2 !== 'YES') {
      console.log('\n❌ Cleanup cancelled.\n');
      rl.close();
      process.exit(0);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🗑️  STARTING CLEANUP...');
    console.log('='.repeat(80) + '\n');

    // Delete MIFOS loans first
    if (loans.length > 0) {
      console.log('🗑️  Deleting MIFOS Loans...');
      for (const loan of loans) {
        try {
          // Try to reject/close the loan first if it's active
          if (loan.status?.value === 'Active') {
            try {
              await api.post(`/v1/loans/${loan.id}?command=close`, {
                transactionDate: new Date().toISOString().split('T')[0],
                locale: 'en',
                dateFormat: 'yyyy-MM-dd'
              });
              console.log(`  ✓ Closed active loan ${loan.id}`);
            } catch (closeError) {
              console.log(`  ⚠️  Could not close loan ${loan.id}, will try to delete anyway`);
            }
          }
          
          // Delete the loan
          await api.delete(`/v1/loans/${loan.id}`);
          console.log(`  ✓ Deleted loan ${loan.id} (${loan.accountNo})`);
        } catch (error) {
          console.log(`  ✗ Failed to delete loan ${loan.id}: ${error.response?.data?.defaultUserMessage || error.message}`);
        }
      }
      console.log(`✅ Processed ${loans.length} loans\n`);
    }

    // Delete MIFOS clients
    if (clients.length > 0) {
      console.log('🗑️  Deleting MIFOS Clients...');
      for (const client of clients) {
        try {
          // First close the client if active
          if (client.status?.value === 'Active') {
            try {
              await api.post(`/v1/clients/${client.id}?command=close`, {
                closureDate: new Date().toISOString().split('T')[0],
                closureReasonId: 1,
                locale: 'en',
                dateFormat: 'yyyy-MM-dd'
              });
              console.log(`  ✓ Closed client ${client.id}`);
            } catch (closeError) {
              console.log(`  ⚠️  Could not close client ${client.id}`);
            }
          }
          
          // Delete the client
          await api.delete(`/v1/clients/${client.id}`);
          console.log(`  ✓ Deleted client ${client.id} (${client.displayName})`);
        } catch (error) {
          console.log(`  ✗ Failed to delete client ${client.id}: ${error.response?.data?.defaultUserMessage || error.message}`);
        }
      }
      console.log(`✅ Processed ${clients.length} clients\n`);
    }

    // Delete MongoDB loan mappings
    if (mappings.length > 0) {
      console.log('🗑️  Deleting MongoDB Loan Mappings...');
      const deleteResult = await LoanMapping.deleteMany({});
      console.log(`✅ Deleted ${deleteResult.deletedCount} loan mappings from MongoDB\n`);
    }

    console.log('='.repeat(80));
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('All data has been cleared. System is ready for fresh start.');
    console.log('='.repeat(80) + '\n');

    await mongoose.connection.close();
    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ ERROR DURING CLEANUP');
    console.error('='.repeat(80));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80) + '\n');
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    rl.close();
    process.exit(1);
  }
}

clearAllData();
