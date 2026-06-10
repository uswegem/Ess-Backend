require('dotenv').config();
const axios = require('axios');

async function testLoanCreation() {
    const baseURL = process.env.CBS_BASE_URL;
    const tenant = process.env.CBS_Tenant;
    const username = process.env.CBS_MAKER_USERNAME;
    const password = process.env.CBS_MAKER_PASSWORD;
    const clientId = 54;

    console.log('🧪 Testing Loan Creation in MIFOS\n');
    console.log('='.repeat(70));

    try {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Fineract-Platform-TenantId': tenant
        };

        // Test loan payload (matching what the code sends)
        const loanPayload = {
            clientId: clientId,
            productId: 17, // ESS Loan product
            principal: "1000000",
            loanTermFrequency: 96,
            loanTermFrequencyType: 2, // Months
            loanType: "individual",
            numberOfRepayments: 96,
            repaymentEvery: 1,
            repaymentFrequencyType: 2, // Monthly
            interestRatePerPeriod: 28, // 28% per year (matching product config)
            interestRateFrequencyType: 3, // Per year
            amortizationType: 1, // Equal installments
            interestType: 0, // Declining balance
            interestCalculationPeriodType: 1, // Same as repayment
            transactionProcessingStrategyCode: "mifos-standard-strategy",
            expectedDisbursementDate: new Date().toISOString().split('T')[0],
            submittedOnDate: new Date().toISOString().split('T')[0],
            dateFormat: "yyyy-MM-dd",
            locale: "en",
            charges: [] // Empty charges array to avoid MIFOS NPE bug
        };

        console.log('\n📋 Loan Payload:');
        console.log(JSON.stringify(loanPayload, null, 2));

        console.log('\n📤 Sending loan creation request...\n');
        
        const response = await axios.post(`${baseURL}/v1/loans`, loanPayload, { headers });
        
        console.log('✅ SUCCESS!');
        console.log('Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('\n❌ LOAN CREATION FAILED!');
        console.error('Error:', error.message);
        
        if (error.response) {
            console.error('\nStatus:', error.response.status);
            console.error('Status Text:', error.response.statusText);
            console.error('\nResponse Data:');
            console.error(JSON.stringify(error.response.data, null, 2));
        }
    }
}

testLoanCreation();
