const axios = require('axios');

// MIFOS CBS Configuration
const CBS_BASE_URL = 'https://zedone-uat.miracore.co.tz/fineract-provider/api';
const CBS_TENANT = 'zedone-uat';
const CBS_USERNAME = 'ess_creater';
const CBS_PASSWORD = 'Jothanum@123456';

const auth = Buffer.from(`${CBS_USERNAME}:${CBS_PASSWORD}`).toString('base64');

const api = axios.create({
    baseURL: CBS_BASE_URL,
    headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Fineract-Platform-TenantId': CBS_TENANT
    }
});

async function testTopUpAPI() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TESTING MIFOS TOP-UP LOAN API - V2');
    console.log('='.repeat(80) + '\n');

    try {
        // Get template with templateType parameter
        console.log('📋 Step 1: Getting loan template with templateType=individual...');
        const templateResponse = await api.get('/v1/loans/template?clientId=56&productId=17&templateType=individual');
        const template = templateResponse.data;
        
        console.log('✅ Loan template retrieved successfully');
        console.log('\n📊 Checking for top-up support:');
        console.log('  - isTopup field:', template.isTopup !== undefined ? `EXISTS (${template.isTopup})` : 'NOT FOUND ❌');
        console.log('  - loanIdToClose field:', template.loanIdToClose !== undefined ? 'EXISTS ✅' : 'NOT FOUND ❌');
        
        if (template.product) {
            console.log('  - Product allowTopup:', template.product.allowTopup !== undefined ? 
                `${template.product.allowTopup ? 'YES ✅' : 'NO ❌'}` : 'FIELD NOT FOUND');
            console.log('  - Product canUseForTopup:', template.product.canUseForTopup !== undefined ? 
                `${template.product.canUseForTopup ? 'YES ✅' : 'NO ❌'}` : 'FIELD NOT FOUND');
        }

        // Check for active loan options
        if (template.clientActiveLoanOptions) {
            console.log('\n📋 Client Active Loan Options (available for top-up/closure):');
            template.clientActiveLoanOptions.forEach(loan => {
                console.log(`  ✓ Loan ${loan.id} (${loan.accountNo}): ${loan.productName} - ${loan.principal}`);
            });
        } else {
            console.log('\n⚠️  clientActiveLoanOptions: NOT FOUND');
        }

        // Try to get loan product details
        console.log('\n📋 Step 2: Getting loan product 17 details...');
        const productResponse = await api.get('/v1/loanproducts/17');
        const product = productResponse.data;
        
        console.log('✅ Product details retrieved');
        console.log('\n📊 Product Top-Up Configuration:');
        console.log('  - allowTopup:', product.allowTopup !== undefined ? `${product.allowTopup ? 'YES ✅' : 'NO ❌'}` : 'NOT FOUND');
        console.log('  - canUseForTopup:', product.canUseForTopup !== undefined ? `${product.canUseForTopup ? 'YES ✅' : 'NO ❌'}` : 'NOT FOUND');
        console.log('  - multiDisburseLoan:', product.multiDisburseLoan !== undefined ? `${product.multiDisburseLoan ? 'YES ✅' : 'NO ❌'}` : 'NOT FOUND');
        console.log('  - maxTrancheCount:', product.maxTrancheCount || 'NOT SET');

        // Check if there's a specific top-up endpoint
        console.log('\n📋 Step 3: Checking available loan commands...');
        console.log('Common MIFOS loan commands:');
        console.log('  - approve');
        console.log('  - disburse');
        console.log('  - disburseToSavings');
        console.log('  - undoDisbursal');
        console.log('  - makeRepayment');
        console.log('  - writeOff');
        console.log('  - close');
        console.log('  - topup (if supported)');

        console.log('\n' + '='.repeat(80));
        console.log('📝 ANALYSIS:');
        console.log('='.repeat(80));
        
        if (template.clientActiveLoanOptions && template.clientActiveLoanOptions.length > 0) {
            console.log('\n✅ GOOD NEWS: clientActiveLoanOptions is available!');
            console.log('   This suggests MIFOS may support top-up loans.');
            console.log('\n💡 APPROACH 1: Use isTopup + loanIdToClose parameters');
            console.log('   When creating a new loan, add:');
            console.log('   {');
            console.log('     isTopup: true,');
            console.log('     loanIdToClose: 28  // ID of active loan to close');
            console.log('   }');
            console.log('   MIFOS should automatically close old loan and create new consolidated loan.');
        } else {
            console.log('\n⚠️  clientActiveLoanOptions not found');
            console.log('   MIFOS may not support automatic top-up.');
        }

        if (product.multiDisburseLoan) {
            console.log('\n💡 APPROACH 2: Use Multi-Disbursement');
            console.log('   Product supports multiple disbursements!');
            console.log('   Create loan once, disburse multiple times.');
        }

        console.log('\n💡 APPROACH 3: Manual Process');
        console.log('   1. Create new loan for top-up amount');
        console.log('   2. Manually close/repay old loan');
        console.log('   3. Activate new loan');

        console.log('\n' + '='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Error:', error.response?.data?.errors || error.message);
        if (error.response?.data) {
            console.error('\nFull response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testTopUpAPI();
