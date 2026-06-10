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
    console.log('🧪 TESTING MIFOS TOP-UP LOAN API');
    console.log('='.repeat(80) + '\n');

    try {
        // First, get client 56 (who has loan 28)
        console.log('📋 Step 1: Getting client 56 details...');
        const clientResponse = await api.get('/v1/clients/56?associations=all');
        const client = clientResponse.data;
        console.log('✅ Client found:', {
            id: client.id,
            accountNo: client.accountNo,
            displayName: client.displayName,
            status: client.status.value
        });

        // Get loan accounts
        console.log('\n📋 Step 2: Getting loan accounts...');
        const accountsResponse = await api.get('/v1/clients/56/accounts');
        const loanAccounts = accountsResponse.data.loanAccounts;
        console.log('✅ Loan accounts:', loanAccounts.map(l => ({
            id: l.id,
            accountNo: l.accountNo,
            productName: l.productName,
            status: l.status.value,
            principal: l.originalLoan
        })));

        // Find active loan
        const activeLoan = loanAccounts.find(l => l.status.id === 300);
        if (!activeLoan) {
            console.log('❌ No active loan found for testing');
            return;
        }

        console.log('\n✅ Active loan found:', {
            id: activeLoan.id,
            accountNo: activeLoan.accountNo,
            principal: activeLoan.originalLoan
        });

        // Test top-up loan creation
        console.log('\n📋 Step 3: Testing top-up loan creation...');
        console.log('⚠️  NOTE: This is a DRY RUN - checking if API accepts the parameters\n');

        const topUpAmount = 1000000; // 1M TZS top-up
        const topUpPayload = {
            clientId: client.id,
            productId: 17,
            principal: topUpAmount.toString(),
            loanTermFrequency: 60,
            loanTermFrequencyType: 2,
            loanType: "individual",
            numberOfRepayments: 60,
            repaymentEvery: 1,
            repaymentFrequencyType: 2,
            interestRatePerPeriod: 24,
            interestRateFrequencyType: 3,
            amortizationType: 1,
            interestType: 0,
            interestCalculationPeriodType: 1,
            transactionProcessingStrategyCode: "mifos-standard-strategy",
            expectedDisbursementDate: new Date().toISOString().split('T')[0],
            submittedOnDate: new Date().toISOString().split('T')[0],
            dateFormat: "yyyy-MM-dd",
            locale: "en",
            charges: [],
            // Top-up specific parameters
            isTopup: true,
            loanIdToClose: activeLoan.id
        };

        console.log('Payload:', JSON.stringify(topUpPayload, null, 2));

        // Check if loan template supports top-up
        console.log('\n📋 Step 4: Checking loan product template for top-up support...');
        try {
            const templateResponse = await api.get(`/v1/loans/template?clientId=${client.id}&productId=17`);
            const template = templateResponse.data;
            
            console.log('\n✅ Loan template retrieved');
            console.log('Available parameters:');
            console.log('  - isTopup:', template.isTopup !== undefined ? 'SUPPORTED ✅' : 'NOT FOUND ❌');
            console.log('  - loanIdToClose:', template.loanIdToClose !== undefined ? 'SUPPORTED ✅' : 'NOT FOUND ❌');
            
            if (template.product) {
                console.log('  - Product allows top-up:', template.product.allowTopup ? 'YES ✅' : 'NO ❌');
            }

            // Check if there's a topup option
            if (template.clientActiveLoanOptions) {
                console.log('\n📋 Client Active Loan Options (for top-up):');
                template.clientActiveLoanOptions.forEach(loan => {
                    console.log(`  - Loan ${loan.id} (${loan.accountNo}): ${loan.productName}`);
                });
            } else {
                console.log('\n⚠️  No clientActiveLoanOptions found in template');
            }

        } catch (templateError) {
            console.log('❌ Error getting template:', templateError.response?.data?.errors || templateError.message);
        }

        console.log('\n' + '='.repeat(80));
        console.log('📝 CONCLUSION:');
        console.log('='.repeat(80));
        console.log('To create a top-up loan in MIFOS, you typically need to:');
        console.log('1. Check if the loan product supports top-up (allowTopup flag)');
        console.log('2. Use special API endpoint or parameters for top-up creation');
        console.log('3. MIFOS may require repayment of old loan first, then new loan');
        console.log('\nCommon approaches:');
        console.log('  A) Create new loan + manually repay old loan');
        console.log('  B) Use loan reschedule/restructure API');
        console.log('  C) Use specific top-up endpoint if available');
        console.log('='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Error:', error.response?.data?.errors || error.message);
        if (error.response?.data) {
            console.error('Full response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testTopUpAPI();
