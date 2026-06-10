require('dotenv').config();
const axios = require('axios');
const { MongoClient } = require('mongodb');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

// MIFOS Configuration
const MIFOS_BASE_URL = process.env.CBS_BASE_URL;
const MIFOS_TENANT = process.env.CBS_Tenant;
const MIFOS_USERNAME = process.env.CBS_MAKER_USERNAME;
const MIFOS_PASSWORD = process.env.CBS_MAKER_PASSWORD;

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI;

// Create MIFOS axios instance
const mifosApi = axios.create({
  baseURL: MIFOS_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Fineract-Platform-TenantId': MIFOS_TENANT
  },
  auth: {
    username: MIFOS_USERNAME,
    password: MIFOS_PASSWORD
  }
});

async function writeOffLoan(loanId, accountNo) {
  try {
    // Write off the loan with today's date
    const today = new Date().toISOString().split('T')[0].split('-');
    const writeOffData = {
      transactionDate: `${today[2]} ${getMonthName(parseInt(today[1]))} ${today[0]}`,
      dateFormat: "dd MMMM yyyy",
      locale: "en",
      note: "System cleanup - forced write-off"
    };

    await mifosApi.post(`/v1/loans/${loanId}?command=writeoff`, writeOffData);
    console.log(`  ✓ Written off loan ${loanId} (${accountNo})`);
    return true;
  } catch (error) {
    console.log(`  ⚠️  Could not write off loan ${loanId}: ${error.response?.data?.errors?.[0]?.defaultUserMessage || error.message}`);
    return false;
  }
}

function getMonthName(month) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1];
}

async function rejectLoan(loanId, accountNo) {
  try {
    const today = new Date().toISOString().split('T')[0].split('-');
    const rejectData = {
      rejectedOnDate: `${today[2]} ${getMonthName(parseInt(today[1]))} ${today[0]}`,
      dateFormat: "dd MMMM yyyy",
      locale: "en",
      note: "System cleanup - forced rejection"
    };

    await mifosApi.post(`/v1/loans/${loanId}?command=reject`, rejectData);
    console.log(`  ✓ Rejected loan ${loanId} (${accountNo})`);
    return true;
  } catch (error) {
    console.log(`  ⚠️  Could not reject loan ${loanId}: ${error.response?.data?.errors?.[0]?.defaultUserMessage || error.message}`);
    return false;
  }
}

async function deleteLoan(loanId, accountNo) {
  try {
    await mifosApi.delete(`/v1/loans/${loanId}`);
    console.log(`  ✓ Deleted loan ${loanId} (${accountNo})`);
    return true;
  } catch (error) {
    console.log(`  ✗ Failed to delete loan ${loanId}: ${error.response?.data?.errors?.[0]?.defaultUserMessage || error.message}`);
    return false;
  }
}

async function closeClient(clientId, name) {
  try {
    const today = new Date().toISOString().split('T')[0].split('-');
    const closeData = {
      closureDate: `${today[2]} ${getMonthName(parseInt(today[1]))} ${today[0]}`,
      dateFormat: "dd MMMM yyyy",
      locale: "en",
      closureReasonId: 1 // You may need to adjust this
    };

    await mifosApi.post(`/v1/clients/${clientId}?command=close`, closeData);
    console.log(`  ✓ Closed client ${clientId} (${name})`);
    return true;
  } catch (error) {
    console.log(`  ⚠️  Could not close client ${clientId}: ${error.response?.data?.errors?.[0]?.defaultUserMessage || error.message}`);
    return false;
  }
}

async function deleteClient(clientId, name) {
  try {
    await mifosApi.delete(`/v1/clients/${clientId}`);
    console.log(`  ✓ Deleted client ${clientId} (${name})`);
    return true;
  } catch (error) {
    console.log(`  ✗ Failed to delete client ${clientId}: ${error.response?.data?.errors?.[0]?.defaultUserMessage || error.message}`);
    return false;
  }
}

async function main() {
  let mongoClient;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  FORCE CLEANUP - MIFOS & MongoDB (API Method)');
    console.log('='.repeat(80) + '\n');

    // Connect to MongoDB
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = mongoClient.db();
    const loanMappingsCollection = db.collection('loanmappings');

    // Get MongoDB data
    const loanMappings = await loanMappingsCollection.find({}).toArray();
    console.log(`📊 CURRENT DATA:`);
    console.log('─'.repeat(80));
    console.log(`Total Loan Mappings: ${loanMappings.length}\n`);

    // Get MIFOS data
    console.log('📊 Fetching MIFOS data...');
    const loansResponse = await mifosApi.get('/v1/loans?limit=1000');
    const loans = loansResponse.data.pageItems || [];
    
    const clientsResponse = await mifosApi.get('/v1/clients?limit=1000');
    const clients = clientsResponse.data.pageItems || [];

    console.log(`Total MIFOS Loans: ${loans.length}`);
    console.log(`Total MIFOS Clients: ${clients.length}\n`);

    // Display summary
    loans.forEach((loan, index) => {
      console.log(`${index + 1}. Loan ID: ${loan.id} - Account: ${loan.accountNo} - Status: ${loan.status.value}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('⚠️  WARNING: THIS ACTION CANNOT BE UNDONE!');
    console.log('='.repeat(80));
    console.log('This will:');
    console.log(`  • Write off all ${loans.length} active loans in MIFOS`);
    console.log(`  • Delete all ${loans.length} loans from MIFOS`);
    console.log(`  • Delete all ${clients.length} clients from MIFOS`);
    console.log(`  • Delete all ${loanMappings.length} loan mappings from MongoDB`);
    console.log('='.repeat(80) + '\n');

    const confirm1 = await question('Type "DELETE" to confirm deletion: ');
    if (confirm1 !== 'DELETE') {
      console.log('❌ Cleanup cancelled');
      rl.close();
      return;
    }

    const confirm2 = await question('Are you absolutely sure? Type "YES" to proceed: ');
    if (confirm2 !== 'YES') {
      console.log('❌ Cleanup cancelled');
      rl.close();
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('🗑️  STARTING CLEANUP...');
    console.log('='.repeat(80) + '\n');

    // Step 1: Write off and delete loans
    console.log('🗑️  Processing MIFOS Loans...');
    for (const loan of loans) {
      // First, try to write off if active
      if (loan.status.value === 'Active') {
        await writeOffLoan(loan.id, loan.accountNo);
        // Wait a bit for the write-off to process
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      // If pending approval, try to reject
      else if (loan.status.value.includes('pending')) {
        await rejectLoan(loan.id, loan.accountNo);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Now try to delete
      await deleteLoan(loan.id, loan.accountNo);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log(`✅ Processed ${loans.length} loans\n`);

    // Step 2: Close and delete clients
    console.log('🗑️  Processing MIFOS Clients...');
    for (const client of clients) {
      // Try to close if active
      if (client.status?.value === 'Active') {
        await closeClient(client.id, client.displayName);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Try to delete
      await deleteClient(client.id, client.displayName);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log(`✅ Processed ${clients.length} clients\n`);

    // Step 3: Delete MongoDB mappings
    console.log('🗑️  Deleting MongoDB Loan Mappings...');
    const deleteResult = await loanMappingsCollection.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} loan mappings from MongoDB\n`);

    console.log('='.repeat(80));
    console.log('✅ CLEANUP COMPLETED!');
    console.log('='.repeat(80));
    console.log('All loans have been written off and system has been cleaned.');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
    rl.close();
  }
}

main();
