const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

async function setupAccounting() {
  try {
    console.log('=== SETTING UP ACCOUNTING FOR LOAN PRODUCT ===\n');
    
    const productId = 17; // Watumishi Wezesha Loan
    
    // Get current product configuration
    console.log('Fetching current product configuration...');
    const currentProduct = await api.get(`/v1/loanproducts/${productId}`);
    const product = currentProduct.data;
    
    console.log(`\nProduct: ${product.name}`);
    console.log(`Current Accounting: ${product.accountingRule?.value || 'NONE'}\n`);
    
    // Get all GL accounts for reference
    const glAccounts = await api.get('/v1/glaccounts');
    const accounts = glAccounts.data;
    
    // Find account IDs by GL code
    const findAccountId = (glCode) => {
      const account = accounts.find(a => a.glCode === glCode);
      return account ? account.id : null;
    };
    
    // Prepare accounting configuration
    const accountingConfig = {
      // Locale and date format
      locale: 'en',
      dateFormat: 'dd MMMM yyyy',
      
      // Basic product info (required for PUT)
      name: product.name,
      shortName: product.shortName,
      description: product.description || product.name,
      currencyCode: product.currency?.code || 'TZS',
      digitsAfterDecimal: product.currency?.decimalPlaces || 2,
      inMultiplesOf: product.currency?.inMultiplesOf || 0,
      principal: product.principal,
      minPrincipal: product.minPrincipal,
      maxPrincipal: product.maxPrincipal,
      numberOfRepayments: product.numberOfRepayments,
      minNumberOfRepayments: product.minNumberOfRepayments,
      maxNumberOfRepayments: product.maxNumberOfRepayments,
      repaymentEvery: product.repaymentEvery,
      repaymentFrequencyType: product.repaymentFrequencyType?.id || 2,
      interestRatePerPeriod: product.interestRatePerPeriod,
      minInterestRatePerPeriod: product.minInterestRatePerPeriod,
      maxInterestRatePerPeriod: product.maxInterestRatePerPeriod,
      interestRateFrequencyType: product.interestRateFrequencyType?.id || 2,
      amortizationType: product.amortizationType?.id || 1,
      interestType: product.interestType?.id || 0,
      interestCalculationPeriodType: product.interestCalculationPeriodType?.id || 1,
      
      // Accounting setup - ACCRUAL PERIODIC (3)
      accountingRule: 3,
      
      // Asset accounts
      fundSourceAccountId: findAccountId('1001'), // Cash at Bank
      loanPortfolioAccountId: findAccountId('1101'), // Loans to Customers
      receivableInterestAccountId: findAccountId('1102'), // Loan Interest Receivable
      receivableFeeAccountId: findAccountId('1303'), // Fees Receivable
      receivablePenaltyAccountId: findAccountId('1304'), // Penalties Receivable
      
      // Income accounts
      interestOnLoanAccountId: findAccountId('4101'), // Loan Interest Income
      incomeFromFeeAccountId: findAccountId('4201'), // Loan Processing Fees
      incomeFromPenaltyAccountId: findAccountId('4300'), // Other Income (Penalties)
      incomeFromRecoveryAccountId: findAccountId('4300'), // Other Income (Recovery)
      
      // Chargeoff income accounts
      incomeFromChargeOffInterestAccountId: findAccountId('4300'), // Other Income
      incomeFromChargeOffFeesAccountId: findAccountId('4300'), // Other Income
      incomeFromChargeOffPenaltyAccountId: findAccountId('4300'), // Other Income
      
      // Goodwill credit income accounts
      incomeFromGoodwillCreditInterestAccountId: findAccountId('4300'), // Other Income
      incomeFromGoodwillCreditFeesAccountId: findAccountId('4300'), // Other Income
      incomeFromGoodwillCreditPenaltyAccountId: findAccountId('4300'), // Other Income
      
      // Expense accounts
      writeOffAccountId: findAccountId('5400'), // Provision for Loan Losses
      chargeOffExpenseAccountId: findAccountId('5400'), // Provision for Loan Losses
      chargeOffFraudExpenseAccountId: findAccountId('5400'), // Provision for Loan Losses
      goodwillCreditAccountId: findAccountId('5400'), // Provision for Loan Losses
      
      // Transfer and overpayment accounts
      transfersInSuspenseAccountId: findAccountId('1300'), // Other Assets (for transfers in suspense)
      overpaymentLiabilityAccountId: findAccountId('2301') // Accounts Payable
    };
    
    console.log('Accounting Configuration:');
    console.log('  Accounting Rule: ACCRUAL PERIODIC');
    console.log('  Fund Source: 1001 - Cash at Bank');
    console.log('  Loan Portfolio: 1101 - Loans to Customers');
    console.log('  Interest Receivable: 1102 - Loan Interest Receivable');
    console.log('  Fees Receivable: 1303 - Fees Receivable');
    console.log('  Penalties Receivable: 1304 - Penalties Receivable');
    console.log('  Interest Income: 4101 - Loan Interest Income');
    console.log('  Fee Income: 4201 - Loan Processing Fees');
    console.log('  Penalty Income: 4300 - Other Income');
    console.log('  Chargeoff Income (Interest/Fees/Penalty): 4300 - Other Income');
    console.log('  Goodwill Credit Income (Interest/Fees/Penalty): 4300 - Other Income');
    console.log('  Write Off: 5400 - Provision for Loan Losses');
    console.log('  Chargeoff Expenses: 5400 - Provision for Loan Losses');
    console.log('  Goodwill Credit Expense: 5400 - Provision for Loan Losses');
    console.log('  Overpayment Liability: 2301 - Accounts Payable');
    
    console.log('\nUpdating loan product...');
    
    const response = await api.put(`/v1/loanproducts/${productId}`, accountingConfig);
    
    console.log('\n✅ SUCCESS! Accounting has been configured for the loan product.');
    console.log('\nResponse:', JSON.stringify(response.data, null, 2));
    
    // Verify the update
    console.log('\nVerifying configuration...');
    const updatedProduct = await api.get(`/v1/loanproducts/${productId}`);
    console.log(`\nUpdated Accounting Rule: ${updatedProduct.data.accountingRule?.value || 'NONE'}`);
    
    if (updatedProduct.data.accountingMappings) {
      console.log('\nAccounting Mappings:');
      const mappings = updatedProduct.data.accountingMappings;
      if (mappings.fundSourceAccount) {
        console.log(`  Fund Source: ${mappings.fundSourceAccount.glCode} - ${mappings.fundSourceAccount.name}`);
      }
      if (mappings.loanPortfolioAccount) {
        console.log(`  Loan Portfolio: ${mappings.loanPortfolioAccount.glCode} - ${mappings.loanPortfolioAccount.name}`);
      }
      if (mappings.interestOnLoansAccount) {
        console.log(`  Interest Income: ${mappings.interestOnLoansAccount.glCode} - ${mappings.interestOnLoansAccount.name}`);
      }
      if (mappings.incomeFromFeesAccount) {
        console.log(`  Fee Income: ${mappings.incomeFromFeesAccount.glCode} - ${mappings.incomeFromFeesAccount.name}`);
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('\nDetails:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

setupAccounting();
