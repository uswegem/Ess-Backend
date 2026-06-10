const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

async function fixTransferInSuspense() {
  try {
    console.log('=== FIXING TRANSFER IN SUSPENSE ACCOUNT ===\n');
    
    // Get all GL accounts
    const glResponse = await api.get('/v1/glaccounts');
    const accounts = glResponse.data;
    
    // Check if there's a specific "Transfers in Suspense" account
    let transferAccount = accounts.find(a => a.name.toLowerCase().includes('transfer') && a.name.toLowerCase().includes('suspense'));
    
    if (!transferAccount) {
      console.log('No "Transfers in Suspense" account found. Creating one...\n');
      
      // Create new GL account for Transfers in Suspense
      const newAccountData = {
        name: 'Transfers in Suspense',
        glCode: '1305',
        type: 1, // ASSET
        usage: 1, // DETAIL (can accept transactions)
        manualEntriesAllowed: true,
        description: 'Temporary account for loan transfers in progress',
        locale: 'en'
      };
      
      try {
        const createResponse = await api.post('/v1/glaccounts', newAccountData);
        console.log('✅ Created new GL account:', createResponse.data);
        transferAccount = { id: createResponse.data.resourceId, glCode: '1305', name: 'Transfers in Suspense' };
      } catch (error) {
        console.log('⚠️ Could not create new account, using existing detail account instead');
        // Use Prepaid Expenses (1301) as fallback
        transferAccount = accounts.find(a => a.glCode === '1301');
      }
    }
    
    console.log(`\nUsing account: ${transferAccount.glCode} - ${transferAccount.name} (ID: ${transferAccount.id})\n`);
    
    // Get current product configuration
    const productResponse = await api.get('/v1/loanproducts/17');
    const product = productResponse.data;
    
    // Update only the transfersInSuspenseAccountId
    const updateData = {
      locale: 'en',
      transfersInSuspenseAccountId: transferAccount.id
    };
    
    console.log('Updating loan product...');
    const updateResponse = await api.put('/v1/loanproducts/17', updateData);
    
    console.log('\n✅ SUCCESS! Transfer in Suspense account updated.');
    console.log('\nChanges:', JSON.stringify(updateResponse.data.changes, null, 2));
    
    // Verify
    console.log('\nVerifying...');
    const verifyResponse = await api.get('/v1/loanproducts/17');
    const mapping = verifyResponse.data.accountingMappings.transfersInSuspenseAccount;
    
    console.log(`\n✅ Verified: ${mapping.glCode} - ${mapping.name}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

fixTransferInSuspense();
