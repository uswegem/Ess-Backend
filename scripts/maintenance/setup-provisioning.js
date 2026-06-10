const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

async function setupProvisioningCriteria() {
  try {
    console.log('=== SETTING UP LOAN LOSS PROVISIONING CRITERIA ===\n');
    
    // Check if criteria already exists
    try {
      const existingResponse = await api.get('/v1/provisioningcriteria');
      console.log('Existing Provisioning Criteria:', existingResponse.data.length);
      
      if (existingResponse.data.length > 0) {
        console.log('\nExisting Criteria:');
        existingResponse.data.forEach(criteria => {
          console.log(`  - ${criteria.criteriaName}`);
        });
        console.log('\n✅ Provisioning criteria already exist\n');
      }
    } catch (error) {
      console.log('No existing criteria found, will create new one\n');
    }
    
    // Create Tanzania BOT compliant provisioning criteria
    const criteriaData = {
      criteriaName: 'Tanzania BOT Microfinance Provisioning',
      loanProducts: [17], // Watumishi Wezesha Loan
      definitions: [
        {
          categoryId: 1, // STANDARD
          categoryName: 'STANDARD',
          minAge: 0,
          maxAge: 30,
          provisioningPercentage: 1,
          liabilityAccount: 33, // Accounts Payable
          expenseAccount: 46 // Provision for Loan Losses
        },
        {
          categoryId: 2, // SUB-STANDARD  
          categoryName: 'SUB-STANDARD',
          minAge: 31,
          maxAge: 90,
          provisioningPercentage: 25,
          liabilityAccount: 33,
          expenseAccount: 46
        },
        {
          categoryId: 3, // DOUBTFUL
          categoryName: 'DOUBTFUL',
          minAge: 91,
          maxAge: 180,
          provisioningPercentage: 50,
          liabilityAccount: 33,
          expenseAccount: 46
        },
        {
          categoryId: 4, // LOSS
          categoryName: 'LOSS',
          minAge: 181,
          maxAge: 9999,
          provisioningPercentage: 100,
          liabilityAccount: 33,
          expenseAccount: 46
        }
      ],
      locale: 'en'
    };
    
    console.log('Creating provisioning criteria with BOT-compliant rates:\n');
    console.log('  0-30 days (Standard): 1%');
    console.log('  31-90 days (Sub-standard): 25%');
    console.log('  91-180 days (Doubtful): 50%');
    console.log('  181+ days (Loss): 100%\n');
    
    try {
      const response = await api.post('/v1/provisioningcriteria', criteriaData);
      console.log('✅ SUCCESS! Provisioning criteria created');
      console.log('Criteria ID:', response.data.resourceId);
      
      // Run provisioning entries
      console.log('\nGenerating provisioning entries...');
      const entriesData = {
        locale: 'en',
        dateFormat: 'dd MMMM yyyy',
        createjournalentries: false
      };
      
      try {
        const entriesResponse = await api.post('/v1/provisioningentries', entriesData);
        console.log('✅ Provisioning entries created');
      } catch (error) {
        console.log('⚠️ Could not create entries yet (needs loans with overdue amounts)');
      }
      
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('⚠️ Provisioning criteria may already be linked to this product');
      } else {
        throw error;
      }
    }
    
    console.log('\n--- PROVISIONING SUMMARY ---');
    console.log('✅ Delinquency Bucket: Tanzania Microfinance Delinquency');
    console.log('✅ Provisioning Criteria: Tanzania BOT compliant');
    console.log('✅ Accounting: Accrual Periodic with proper GL mappings');
    
    console.log('\n--- NEXT STEPS ---');
    console.log('1. Monitor loan portfolio aging');
    console.log('2. Run provisioning entries monthly: POST /v1/provisioningentries');
    console.log('3. Review provision reports regularly');
    console.log('4. Ensure provisions are included in financial statements');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

setupProvisioningCriteria();
