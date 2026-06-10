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

async function testRescheduleAPI() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TESTING MIFOS RESCHEDULE/RESTRUCTURE API CAPABILITIES');
    console.log('='.repeat(80) + '\n');

    try {
        // Get active loan for testing
        console.log('📋 Step 1: Getting active loan for testing...');
        const accountsResponse = await api.get('/v1/clients/56/accounts');
        const activeLoan = accountsResponse.data.loanAccounts.find(l => l.status.id === 300);
        
        if (!activeLoan) {
            console.log('❌ No active loan found');
            return;
        }

        console.log('✅ Active loan found:', {
            id: activeLoan.id,
            accountNo: activeLoan.accountNo,
            principal: activeLoan.originalLoan,
            status: activeLoan.status.value
        });

        // Get loan details
        console.log('\n📋 Step 2: Getting loan details...');
        const loanResponse = await api.get(`/v1/loans/${activeLoan.id}`);
        const loan = loanResponse.data;
        
        console.log('Current loan details:', {
            id: loan.id,
            principal: loan.principal,
            termFrequency: loan.termFrequency,
            interestRate: loan.interestRatePerPeriod,
            numberOfRepayments: loan.numberOfRepayments,
            repaymentEvery: loan.repaymentEvery
        });

        // Check reschedule template
        console.log('\n📋 Step 3: Getting reschedule template...');
        const templateResponse = await api.get(`/v1/rescheduleloans/template?loanId=${activeLoan.id}`);
        const template = templateResponse.data;
        
        console.log('✅ Reschedule template retrieved');
        console.log('\nAvailable template fields:');
        Object.keys(template).forEach(key => {
            console.log(`  - ${key}: ${typeof template[key]}`);
        });

        // Test reschedule payload
        console.log('\n📋 Step 4: Testing reschedule payload structure...');
        
        const testPayload = {
            dateFormat: "dd MMMM yyyy",
            locale: "en",
            rescheduleFromDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
            rescheduleReasonId: 1,
            submittedOnDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
            adjustedDueDate: new Date(new Date().setMonth(new Date().getMonth() + 12)).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
            graceOnPrincipal: 0,
            graceOnInterest: 0,
            extraTerms: 0,
            rescheduleReasonComment: "Testing reschedule API capabilities"
        };

        console.log('Payload:', JSON.stringify(testPayload, null, 2));

        console.log('\n' + '='.repeat(80));
        console.log('📊 ANALYSIS - What MIFOS Reschedule API Supports:');
        console.log('='.repeat(80));
        console.log('\n✅ SUPPORTED by reschedule API:');
        console.log('  1. Change repayment dates (adjustedDueDate)');
        console.log('  2. Add grace periods (graceOnPrincipal, graceOnInterest)');
        console.log('  3. Extend loan tenure indirectly (by adjusting due date)');
        console.log('  4. Add extra terms/installments');
        
        console.log('\n❌ NOT SUPPORTED by reschedule API:');
        console.log('  1. Change loan principal/amount');
        console.log('  2. Change interest rate (in most MIFOS versions)');
        console.log('  3. Change monthly repayment amount directly');
        console.log('  4. Add new disbursement amount');

        console.log('\n💡 ALTERNATIVES for changing loan amount or EMI:');
        console.log('\n1. LOAN MODIFICATION (if enabled):');
        console.log('   - Some MIFOS versions have loan modification API');
        console.log('   - Allows changing loan terms including principal');
        console.log('   - Check: GET /v1/loans/{id}/template?command=modify');

        console.log('\n2. REFINANCING:');
        console.log('   - Close existing loan');
        console.log('   - Create new loan with desired terms');
        console.log('   - Most common approach for changing loan amount');

        console.log('\n3. TOP-UP LOAN:');
        console.log('   - Create new loan to top up existing');
        console.log('   - System consolidates both loans');
        console.log('   - Uses isTopup=true parameter');

        // Check if loan modification is available
        console.log('\n📋 Step 5: Checking for loan modification support...');
        try {
            const modifyTemplateResponse = await api.get(`/v1/loans/${activeLoan.id}/template?command=modify`);
            console.log('✅ Loan modification template available!');
            console.log('Available modification fields:');
            Object.keys(modifyTemplateResponse.data).forEach(key => {
                if (!['loanOfficerOptions', 'loanPurposeOptions', 'fundOptions', 'termFrequencyTypeOptions', 'repaymentFrequencyTypeOptions', 'interestRateFrequencyTypeOptions', 'amortizationTypeOptions', 'interestTypeOptions', 'interestCalculationPeriodTypeOptions', 'transactionProcessingStrategyOptions'].includes(key)) {
                    console.log(`  - ${key}`);
                }
            });
        } catch (modifyError) {
            console.log('❌ Loan modification not available');
        }

        console.log('\n' + '='.repeat(80));
        console.log('💡 RECOMMENDATION FOR RESTRUCTURE:');
        console.log('='.repeat(80));
        console.log('\nBased on customer requirements:');
        console.log('\n1️⃣  If customer wants to EXTEND TENURE only:');
        console.log('   → Use reschedule API (current implementation) ✅');
        
        console.log('\n2️⃣  If customer wants to CHANGE MONTHLY REPAYMENT:');
        console.log('   → Requires refinancing (close old, create new loan) ❌');
        console.log('   → Or use loan modification API if available');
        
        console.log('\n3️⃣  If customer wants to INCREASE LOAN AMOUNT:');
        console.log('   → Use TOP-UP loan (already implemented) ✅');
        console.log('   → Or refinancing approach');

        console.log('\n' + '='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Error:', error.response?.data?.errors || error.message);
        if (error.response?.data) {
            console.error('\nFull response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testRescheduleAPI();
