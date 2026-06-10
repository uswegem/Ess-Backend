const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

async function checkLoanProductSetup() {
  try {
    console.log('=== LOAN PRODUCT CONFIGURATION REVIEW ===\n');
    
    // Get loan product details
    const productResponse = await api.get('/v1/loanproducts/17');
    const product = productResponse.data;
    
    console.log('Product:', product.name);
    console.log('Short Name:', product.shortName);
    console.log('\n--- BASIC SETTINGS ---');
    console.log('Currency:', product.currency.code);
    console.log('Principal Range:', product.minPrincipal, '-', product.maxPrincipal);
    console.log('Interest Rate:', product.interestRatePerPeriod + '%');
    console.log('Repayment Frequency:', product.repaymentEvery, product.repaymentFrequencyType.value);
    console.log('Number of Repayments:', product.minNumberOfRepayments, '-', product.maxNumberOfRepayments);
    
    console.log('\n--- DELINQUENCY BUCKET ---');
    if (product.delinquencyBucket) {
      console.log('Bucket:', product.delinquencyBucket.name);
      console.log('Bucket ID:', product.delinquencyBucket.id);
      
      // Get full delinquency bucket details
      const bucketResponse = await api.get(`/v1/delinquency/buckets/${product.delinquencyBucket.id}`);
      const bucket = bucketResponse.data;
      
      console.log('\nDelinquency Ranges:');
      bucket.ranges.forEach(range => {
        console.log(`  ${range.classification.padEnd(20)} | Days ${range.minimumAgeDays}-${range.maximumAgeDays}`);
      });
    } else {
      console.log('❌ NO DELINQUENCY BUCKET ASSIGNED!');
    }
    
    console.log('\n--- PROVISIONING CONFIGURATION ---');
    console.log('Provision Category:', product.loanProductProvisioningEntries?.length > 0 ? 'Configured' : '❌ NOT CONFIGURED');
    
    // Get provisioning categories
    const provisioningResponse = await api.get('/v1/provisioningcategory');
    const categories = provisioningResponse.data;
    
    console.log('\nAvailable Provisioning Categories:');
    categories.forEach(cat => {
      console.log(`  ID ${cat.id}: ${cat.categoryName} (${cat.categoryDescription || 'No description'})`);
    });
    
    // Get LoanLossProvisioningCriteria
    try {
      const criteriaResponse = await api.get('/v1/loanproducts/17/provisioningcriteria');
      console.log('\n✅ Provisioning Criteria Assigned');
      console.log(JSON.stringify(criteriaResponse.data, null, 2));
    } catch (error) {
      console.log('\n⚠️ No Provisioning Criteria assigned to this product');
    }
    
    console.log('\n--- TANZANIA MICROFINANCE REGULATORY REQUIREMENTS ---');
    console.log('\n1. Delinquency Classification (BOT Requirements):');
    console.log('   ✅ 1-30 days: Current/Performing');
    console.log('   ✅ 31-60 days: Watch/Special Mention');
    console.log('   ✅ 61-90 days: Substandard');
    console.log('   ✅ 91-120 days: Doubtful');
    console.log('   ✅ 121-180 days: Loss');
    console.log('   ✅ 181+ days: Bad Debt');
    
    console.log('\n2. Provisioning Requirements (BOT):');
    console.log('   - Current (0-30 days): 1% provision');
    console.log('   - Watch (31-60 days): 5% provision');
    console.log('   - Substandard (61-90 days): 25% provision');
    console.log('   - Doubtful (91-180 days): 50% provision');
    console.log('   - Loss (181+ days): 100% provision');
    
    console.log('\n3. Current Configuration Status:');
    if (product.delinquencyBucket) {
      console.log('   ✅ Delinquency bucket configured');
    } else {
      console.log('   ❌ Delinquency bucket NOT configured');
    }
    
    console.log('\n--- RECOMMENDATION ---');
    if (!product.delinquencyBucket || product.loanProductProvisioningEntries?.length === 0) {
      console.log('⚠️ ACTION REQUIRED:');
      console.log('   1. Verify delinquency bucket matches BOT requirements');
      console.log('   2. Configure loan loss provisioning criteria');
      console.log('   3. Assign provisioning category to loan product');
    } else {
      console.log('✅ Product appears properly configured');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

checkLoanProductSetup();
