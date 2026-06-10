require('dotenv').config();
const axios = require('axios');

// MIFOS Configuration
const MIFOS_BASE_URL = process.env.CBS_BASE_URL;
const MIFOS_TENANT = process.env.CBS_Tenant;
const MIFOS_USERNAME = process.env.CBS_MAKER_USERNAME;
const MIFOS_PASSWORD = process.env.CBS_MAKER_PASSWORD;

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

async function setupLoanAccounting() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 SETTING UP ACCOUNTING FOR LOAN PRODUCT 17');
    console.log('='.repeat(80) + '\n');

    // Get current loan product configuration
    console.log('📊 Fetching current loan product configuration...');
    const productResponse = await mifosApi.get('/v1/loanproducts/17');
    const product = productResponse.data;
    
    console.log(`✅ Loan Product: ${product.name} (ID: ${product.id})`);
    console.log(`   Current Accounting Rule: ${product.accountingRule?.value || 'None'}\n`);

    // Update loan product with accrual accounting
    console.log('🔧 Updating loan product with accrual accounting...\n');
    
    const accountingMapping = {
      // Accounting rule: 1=None, 2=Cash, 3=Accrual (periodic), 4=Accrual (upfront)
      accountingRule: 3, // Accrual (periodic)
      
      // Fund source account (Asset - usually Cash/Bank)
      fundSourceAccountId: 6, // Cash at Bank (1001)
      
      // Loan portfolio account (Asset - Loans to Customers)
      loanPortfolioAccountId: 9, // Loans to Customers (1101)
      
      // Interest on loans account (Income - Loan Interest Income)
      interestOnLoanAccountId: 38, // Loan Interest Income (4101)
      
      // Income from fees (Income - Loan Processing Fees)
      incomeFromFeeAccountId: 40, // Loan Processing Fees (4201)
      
      // Income from penalties (Income - Other Income)
      incomeFromPenaltyAccountId: 41, // Other Income (4300)
      
      // Overpayment liability (Liability - Other Liabilities)
      overpaymentLiabilityAccountId: 16, // Other Liabilities (2300)
      
      // Transfer in suspense (Asset - Other Assets)
      transfersInSuspenseAccountId: 13, // Other Assets (1300)
      
      // Income from recovery (Income - Other Income)
      incomeFromRecoveryAccountId: 41, // Other Income (4300)
      
      // Losses written off (Expense - Provision for Loan Losses)
      writeOffAccountId: 46, // Provision for Loan Losses (5400)
      
      // Interest receivable (Asset - Loan Interest Receivable)
      receivableInterestAccountId: 25, // Loan Interest Receivable (1102)
      
      // Fees receivable (Asset - Fees Receivable)
      receivableFeeAccountId: 47, // Fees Receivable (1303)
      
      // Penalties receivable (Asset - Penalties Receivable)
      receivablePenaltyAccountId: 48, // Penalties Receivable (1304)
      
      // Income from charge off interest (Income - Other Income)
      incomeFromChargeOffInterestAccountId: 41, // Other Income (4300)
      
      // Income from charge off fees (Income - Loan Processing Fees)
      incomeFromChargeOffFeesAccountId: 40, // Loan Processing Fees (4201)
      
      // Charge off expense (Expense - Provision for Loan Losses)
      chargeOffExpenseAccountId: 46, // Provision for Loan Losses (5400)
      
      // Charge off fraud expense (Expense - Provision for Loan Losses)
      chargeOffFraudExpenseAccountId: 46, // Provision for Loan Losses (5400)
      
      // Income from goodwill credit interest (Income - Other Income)
      incomeFromGoodwillCreditInterestAccountId: 41, // Other Income (4300)
      
      // Income from goodwill credit fees (Income - Loan Processing Fees)
      incomeFromGoodwillCreditFeesAccountId: 40, // Loan Processing Fees (4201)
      
      // Income from goodwill credit penalty (Income - Other Income)
      incomeFromGoodwillCreditPenaltyAccountId: 41, // Other Income (4300)
      
      locale: "en",
      dateFormat: "dd MMMM yyyy"
    };

    console.log('📋 Account Mapping:');
    console.log('   Fund Source: Cash at Bank (6 - 1001)');
    console.log('   Loan Portfolio: Loans to Customers (9 - 1101)');
    console.log('   Interest Income: Loan Interest Income (38 - 4101)');
    console.log('   Fee Income: Loan Processing Fees (40 - 4201)');
    console.log('   Penalty Income: Other Income (41 - 4300)');
    console.log('   Overpayment Liability: Other Liabilities (16 - 2300)');
    console.log('   Write Off: Provision for Loan Losses (46 - 5400)');
    console.log('   Interest Receivable: Loan Interest Receivable (25 - 1102)');
    console.log('   Fees Receivable: Fees Receivable (47 - 1303)');
    console.log('   Penalties Receivable: Penalties Receivable (48 - 1304)\n');

    const updateResponse = await mifosApi.put('/v1/loanproducts/17', accountingMapping);
    
    console.log('✅ Accounting setup completed successfully!');
    console.log(`   Resource ID: ${updateResponse.data.resourceId}`);
    console.log('\n' + '='.repeat(80));
    console.log('✅ LOAN PRODUCT 17 IS NOW CONFIGURED WITH ACCRUAL ACCOUNTING');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error setting up accounting:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

setupLoanAccounting();
