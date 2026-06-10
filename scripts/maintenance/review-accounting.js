const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

async function reviewAccounting() {
  try {
    // 1. Get Chart of Accounts
    console.log('=== CHART OF ACCOUNTS ===\n');
    const glResponse = await api.get('/v1/glaccounts');
    const accounts = glResponse.data;
    
    console.log(`Total GL Accounts: ${accounts.length}\n`);
    
    const accountsByType = {
      ASSET: [],
      LIABILITY: [],
      EQUITY: [],
      INCOME: [],
      EXPENSE: []
    };
    
    accounts.forEach(acc => {
      const type = acc.type?.value || 'Unknown';
      if (accountsByType[type]) {
        accountsByType[type].push(acc);
      }
    });
    
    // Display accounts by type
    Object.keys(accountsByType).forEach(type => {
      if (accountsByType[type].length > 0) {
        console.log(`\n--- ${type} (${accountsByType[type].length}) ---`);
        accountsByType[type].forEach(acc => {
          console.log(`  ${acc.glCode.padEnd(6)} | ${acc.name}`);
        });
      }
    });
    
    // 2. Get Loan Products
    console.log('\n\n=== LOAN PRODUCTS ===\n');
    const productsResponse = await api.get('/v1/loanproducts');
    const products = productsResponse.data;
    
    console.log(`Total Products: ${products.length}\n`);
    
    for (const product of products) {
      console.log(`\nProduct: ${product.name} (${product.shortName})`);
      console.log(`  ID: ${product.id}`);
      console.log(`  Accounting: ${product.accountingRule?.value || 'NONE'}`);
    }
    
    // 3. Get detailed product info with accounting
    console.log('\n\n=== DETAILED PRODUCT ACCOUNTING ===\n');
    
    for (const product of products) {
      const detailResponse = await api.get(`/v1/loanproducts/${product.id}`);
      const detail = detailResponse.data;
      
      console.log(`\n${detail.name}:`);
      console.log(`  Accounting Rule: ${detail.accountingRule?.value || 'NONE'}`);
      
      if (detail.accountingMappings) {
        console.log('  Mappings:');
        if (detail.accountingMappings.fundSourceAccount) {
          console.log(`    Fund Source: ${detail.accountingMappings.fundSourceAccount.glCode} - ${detail.accountingMappings.fundSourceAccount.name}`);
        }
        if (detail.accountingMappings.loanPortfolioAccount) {
          console.log(`    Loan Portfolio: ${detail.accountingMappings.loanPortfolioAccount.glCode} - ${detail.accountingMappings.loanPortfolioAccount.name}`);
        }
        if (detail.accountingMappings.interestOnLoansAccount) {
          console.log(`    Interest Income: ${detail.accountingMappings.interestOnLoansAccount.glCode} - ${detail.accountingMappings.interestOnLoansAccount.name}`);
        }
        if (detail.accountingMappings.incomeFromFeesAccount) {
          console.log(`    Fee Income: ${detail.accountingMappings.incomeFromFeesAccount.glCode} - ${detail.accountingMappings.incomeFromFeesAccount.name}`);
        }
        if (detail.accountingMappings.incomeFromPenaltiesAccount) {
          console.log(`    Penalty Income: ${detail.accountingMappings.incomeFromPenaltiesAccount.glCode} - ${detail.accountingMappings.incomeFromPenaltiesAccount.name}`);
        }
      } else {
        console.log('  No accounting mappings configured');
      }
    }
    
    console.log('\n\n=== RECOMMENDATIONS ===\n');
    console.log('Based on the chart of accounts, recommended accounting setup:');
    console.log('  - Fund Source Account: 1001 (Cash at Bank)');
    console.log('  - Loan Portfolio Account: 1101 (Loans to Customers)');
    console.log('  - Interest Income Account: 4101 (Loan Interest Income)');
    console.log('  - Fee Income Account: 4201 (Loan Processing Fees)');
    console.log('  - Penalty Income Account: 4300 (Other Income)');
    console.log('  - Interest Receivable: 1102 (Loan Interest Receivable)');
    console.log('  - Fees Receivable: 1303 (Fees Receivable)');
    console.log('  - Penalties Receivable: 1304 (Penalties Receivable)');
    console.log('  - Loan Losses: 5400 (Provision for Loan Losses)');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

reviewAccounting();
