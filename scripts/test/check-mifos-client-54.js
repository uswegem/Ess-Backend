require('dotenv').config();
const axios = require('axios');

async function checkClientLoans() {
    const clientId = '54';
    const baseURL = process.env.CBS_BASE_URL;
    const tenant = process.env.CBS_Tenant;
    const username = process.env.CBS_MAKER_USERNAME;
    const password = process.env.CBS_MAKER_PASSWORD;

    console.log('🔍 Checking MIFOS Client: 000000054\n');
    console.log('='.repeat(70));

    try {
        // Create auth header
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Fineract-Platform-TenantId': tenant
        };

        // 1. Get client details
        console.log('\n📋 1. CLIENT DETAILS:');
        const clientResponse = await axios.get(`${baseURL}/v1/clients/${clientId}`, { headers });
        const client = clientResponse.data;
        
        console.log(`   Client ID: ${client.id}`);
        console.log(`   Account No: ${client.accountNo}`);
        console.log(`   Display Name: ${client.displayName}`);
        console.log(`   External ID (NIN): ${client.externalId || 'N/A'}`);
        console.log(`   Status: ${client.status?.value || 'N/A'}`);
        console.log(`   Mobile: ${client.mobileNo || 'N/A'}`);

        // 2. Get client's accounts (including loans)
        console.log('\n💰 2. CLIENT ACCOUNTS:');
        const accountsResponse = await axios.get(`${baseURL}/v1/clients/${clientId}/accounts`, { headers });
        const accounts = accountsResponse.data;

        if (accounts.loanAccounts && accounts.loanAccounts.length > 0) {
            console.log(`   ✅ FOUND ${accounts.loanAccounts.length} LOAN(S):\n`);
            
            for (const loan of accounts.loanAccounts) {
                console.log(`   Loan ID: ${loan.id}`);
                console.log(`   Account No: ${loan.accountNo}`);
                console.log(`   Product: ${loan.productName}`);
                console.log(`   Status: ${loan.status?.value || 'N/A'}`);
                console.log(`   Principal: ${loan.originalLoan?.toLocaleString() || 'N/A'} TZS`);
                console.log(`   Outstanding: ${loan.loanBalance?.toLocaleString() || 'N/A'} TZS`);
                console.log('   ---');
            }

            // Get detailed info for each loan
            console.log('\n📊 3. DETAILED LOAN INFORMATION:');
            for (const loan of accounts.loanAccounts) {
                try {
                    const loanDetailResponse = await axios.get(
                        `${baseURL}/v1/loans/${loan.id}?associations=all`, 
                        { headers }
                    );
                    const loanDetail = loanDetailResponse.data;
                    
                    console.log(`\n   === LOAN ${loanDetail.id} ===`);
                    console.log(`   Account: ${loanDetail.accountNo}`);
                    console.log(`   Product: ${loanDetail.loanProductName}`);
                    console.log(`   Status: ${loanDetail.status?.value || 'N/A'}`);
                    console.log(`   Principal: ${loanDetail.principal?.toLocaleString()} TZS`);
                    console.log(`   Interest Rate: ${loanDetail.interestRatePerPeriod}% per year`);
                    console.log(`   Term: ${loanDetail.termFrequency} months`);
                    console.log(`   Disbursed Date: ${loanDetail.timeline?.actualDisbursementDate || 'Not disbursed'}`);
                    console.log(`   External ID: ${loanDetail.externalId || 'N/A'}`);
                    
                    if (loanDetail.summary) {
                        console.log(`   Total Outstanding: ${loanDetail.summary.totalOutstanding?.toLocaleString() || 0} TZS`);
                        console.log(`   Total Repaid: ${loanDetail.summary.totalRepayment?.toLocaleString() || 0} TZS`);
                    }
                } catch (err) {
                    console.log(`   ⚠️ Could not fetch details for loan ${loan.id}: ${err.message}`);
                }
            }
        } else {
            console.log('   ❌ NO LOANS FOUND for this client');
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

checkClientLoans();
