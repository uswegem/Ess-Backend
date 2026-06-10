const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

async function checkAccountingDetails() {
  try {
    const productId = 17; // Watumishi Wezesha Loan
    
    console.log('=== DETAILED ACCOUNTING CONFIGURATION ===\n');
    
    const response = await api.get(`/v1/loanproducts/${productId}`);
    const product = response.data;
    
    console.log(`Product: ${product.name}`);
    console.log(`Accounting Rule: ${product.accountingRule?.value || 'NONE'}\n`);
    
    if (product.accountingMappings) {
      const mappings = product.accountingMappings;
      
      console.log('ASSETS / LIABILITIES:');
      console.log(`  Fund Source: ${mappings.fundSourceAccount ? mappings.fundSourceAccount.glCode + ' - ' + mappings.fundSourceAccount.name : '❌ NOT SET'}`);
      console.log(`  Loan Portfolio: ${mappings.loanPortfolioAccount ? mappings.loanPortfolioAccount.glCode + ' - ' + mappings.loanPortfolioAccount.name : '❌ NOT SET'}`);
      console.log(`  Transfer in Suspense: ${mappings.transfersInSuspenseAccount ? mappings.transfersInSuspenseAccount.glCode + ' - ' + mappings.transfersInSuspenseAccount.name : '❌ NOT SET'}`);
      console.log(`  Overpayment Liability: ${mappings.overpaymentLiabilityAccount ? mappings.overpaymentLiabilityAccount.glCode + ' - ' + mappings.overpaymentLiabilityAccount.name : '❌ NOT SET'}`);
      console.log(`  Loan Interest Receivable: ${mappings.receivableInterestAccount ? mappings.receivableInterestAccount.glCode + ' - ' + mappings.receivableInterestAccount.name : '❌ NOT SET'}`);
      console.log(`  Loan Fees Receivable: ${mappings.receivableFeeAccount ? mappings.receivableFeeAccount.glCode + ' - ' + mappings.receivableFeeAccount.name : '❌ NOT SET'}`);
      console.log(`  Loan Penalties Receivable: ${mappings.receivablePenaltyAccount ? mappings.receivablePenaltyAccount.glCode + ' - ' + mappings.receivablePenaltyAccount.name : '❌ NOT SET'}`);
      
      console.log('\nINCOME:');
      console.log(`  Income from Interest: ${mappings.interestOnLoansAccount ? mappings.interestOnLoansAccount.glCode + ' - ' + mappings.interestOnLoansAccount.name : '❌ NOT SET'}`);
      console.log(`  Income from Fees: ${mappings.incomeFromFeesAccount ? mappings.incomeFromFeesAccount.glCode + ' - ' + mappings.incomeFromFeesAccount.name : '❌ NOT SET'}`);
      console.log(`  Income from Penalties: ${mappings.incomeFromPenaltiesAccount ? mappings.incomeFromPenaltiesAccount.glCode + ' - ' + mappings.incomeFromPenaltiesAccount.name : '❌ NOT SET'}`);
      console.log(`  Income from Recovery: ${mappings.incomeFromRecoveryAccount ? mappings.incomeFromRecoveryAccount.glCode + ' - ' + mappings.incomeFromRecoveryAccount.name : '❌ NOT SET'}`);
      console.log(`  Income from Chargeoff Interest: ${mappings.incomeFromChargeOffInterestAccount ? mappings.incomeFromChargeOffInterestAccount.glCode + ' - ' + mappings.incomeFromChargeOffInterestAccount.name : '❌ NOT SET'}`);
      console.log(`  Income from Chargeoff Fees: ${mappings.incomeFromChargeOffFeesAccount ? mappings.incomeFromChargeOffFeesAccount.glCode + ' - ' + mappings.incomeFromChargeOffFeesAccount.name : '❌ NOT SET'}`);
      console.log(`  Income from Chargeoff Penalty: ${mappings.incomeFromChargeOffPenaltyAccount ? mappings.incomeFromChargeOffPenaltyAccount.glCode + ' - ' + mappings.incomeFromChargeOffPenaltyAccount.name : '❌ NOT SET'}`);
      console.log(`  Income from Goodwill Credit Interest: ${mappings.incomeFromGoodwillCreditInterestAccount ? mappings.incomeFromGoodwillCreditInterestAccount.glCode + ' - ' + mappings.incomeFromGoodwillCreditInterestAccount.name : '❌ NOT SET'}`);
      console.log(`  Income from Goodwill Credit Fees: ${mappings.incomeFromGoodwillCreditFeesAccount ? mappings.incomeFromGoodwillCreditFeesAccount.glCode + ' - ' + mappings.incomeFromGoodwillCreditFeesAccount.name : '❌ NOT SET'}`);
      console.log(`  Income from Goodwill Credit Penalty: ${mappings.incomeFromGoodwillCreditPenaltyAccount ? mappings.incomeFromGoodwillCreditPenaltyAccount.glCode + ' - ' + mappings.incomeFromGoodwillCreditPenaltyAccount.name : '❌ NOT SET'}`);
      
      console.log('\nEXPENSES:');
      console.log(`  Losses Written Off: ${mappings.writeOffAccount ? mappings.writeOffAccount.glCode + ' - ' + mappings.writeOffAccount.name : '❌ NOT SET'}`);
      console.log(`  Chargeoff Expense: ${mappings.chargeOffExpenseAccount ? mappings.chargeOffExpenseAccount.glCode + ' - ' + mappings.chargeOffExpenseAccount.name : '❌ NOT SET'}`);
      console.log(`  Chargeoff Fraud Expense: ${mappings.chargeOffFraudExpenseAccount ? mappings.chargeOffFraudExpenseAccount.glCode + ' - ' + mappings.chargeOffFraudExpenseAccount.name : '❌ NOT SET'}`);
      console.log(`  Goodwill Credit Expense: ${mappings.goodwillCreditAccount ? mappings.goodwillCreditAccount.glCode + ' - ' + mappings.goodwillCreditAccount.name : '❌ NOT SET'}`);
      
      console.log('\n=== MISSING FIELDS ===');
      const missing = [];
      if (!mappings.incomeFromChargeOffInterestAccount) missing.push('Income from Chargeoff Interest');
      if (!mappings.incomeFromChargeOffFeesAccount) missing.push('Income from Chargeoff Fees');
      if (!mappings.incomeFromChargeOffPenaltyAccount) missing.push('Income from Chargeoff Penalty');
      if (!mappings.incomeFromGoodwillCreditInterestAccount) missing.push('Income from Goodwill Credit Interest');
      if (!mappings.incomeFromGoodwillCreditFeesAccount) missing.push('Income from Goodwill Credit Fees');
      if (!mappings.incomeFromGoodwillCreditPenaltyAccount) missing.push('Income from Goodwill Credit Penalty');
      if (!mappings.chargeOffExpenseAccount) missing.push('Chargeoff Expense');
      if (!mappings.chargeOffFraudExpenseAccount) missing.push('Chargeoff Fraud Expense');
      if (!mappings.goodwillCreditAccount) missing.push('Goodwill Credit Expense');
      
      if (missing.length > 0) {
        console.log('\nThe following fields need to be configured:');
        missing.forEach(field => console.log(`  ❌ ${field}`));
      } else {
        console.log('\n✅ All accounting fields are properly configured!');
      }
    } else {
      console.log('❌ No accounting mappings found!');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

checkAccountingDetails();
