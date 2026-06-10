const mongoose = require('mongoose');
require('dotenv').config();

// Import required services
const ClientService = require('./src/services/clientService');
const api = require('./src/services/cbs.api');
const logger = require('./src/utils/logger');

// Customer data from the loan mapping (from LOAN_OFFER_REQUEST)
const customerData = {
    checkNumber: "110977381", // From LOAN_OFFER_REQUEST
    nin: "19850612141150000220",
    firstName: "MARRY", 
    middleName: "EDWARD",
    lastName: "NTIGA",
    fullName: "MARRY EDWARD NTIGA",
    sex: "M",
    bankAccountNumber: "9120003342458",
    employmentDate: "2013-03-21",
    maritalStatus: "MARRIED",
    confirmationDate: "2014-03-21",
    physicalAddress: "Dodoma",
    emailAddress: "example@utumishi.go.tz",
    mobileNumber: "0768383511",
    applicationNumber: "ESS1763982075940",
    swiftCode: "SBICTZTX"
};

const loanData = {
    requestedAmount: "4800000.00",
    tenure: "96",
    productCode: "17",
    interestRate: "6000000.00",
    processingFee: "100000.00",
    insurance: "50000.00"
};

/**
 * Create client in CBS with the customer data
 */
async function createClientInCBS() {
    try {
        console.log('🏦 Starting Client Creation in CBS...\n');
        
        // First check if client already exists
        console.log(`🔍 Checking if client exists with NIN: ${customerData.nin}`);
        const existingClient = await ClientService.searchClientByExternalId(customerData.nin);
        
        if (existingClient?.status && existingClient?.response?.pageItems?.length > 0) {
            const client = existingClient.response.pageItems[0];
            console.log(`✅ Client already exists with ID: ${client.id}`);
            console.log(`   Name: ${client.fullname || client.displayName}`);
            console.log(`   Status: ${client.status?.value || 'Unknown'}`);
            return client.id;
        }
        
        console.log('👤 Creating new client in CBS...');
        
        // Prepare client payload using ClientService format
        const clientPayload = {
            firstname: customerData.firstName,
            middlename: customerData.middleName,
            lastname: customerData.lastName,
            externalId: customerData.nin,
            dateOfBirth: extractDateOfBirth(customerData.nin),
            gender: customerData.sex,
            checkNumber: customerData.checkNumber,
            employmentDate: customerData.employmentDate,
            swiftCode: customerData.swiftCode,
            bankAccountNumber: customerData.bankAccountNumber,
            mobileNumber: customerData.mobileNumber,
            emailAddress: customerData.emailAddress
        };
        
        console.log('📄 Client payload:', JSON.stringify(clientPayload, null, 2));
        
        // Create client
        const newClient = await ClientService.createClient(clientPayload);
        
        if (newClient.status && newClient.response) {
            const clientId = newClient.response.clientId;
            console.log(`✅ Client created successfully with ID: ${clientId}`);
            return clientId;
        } else {
            throw new Error('Failed to create client: ' + JSON.stringify(newClient));
        }
        
    } catch (error) {
        console.error('❌ Error creating client:', error.message);
        throw error;
    }
}

/**
 * Create loan in CBS for the client
 */
async function createLoanInCBS(clientId) {
    try {
        console.log('\n💰 Creating Loan in CBS...');
        
        const loanPayload = {
            clientId: clientId,
            productId: 17, // ESS Loan product
            principal: parseFloat(loanData.requestedAmount).toString(),
            loanTermFrequency: parseInt(loanData.tenure),
            loanTermFrequencyType: 2, // Months
            numberOfRepayments: parseInt(loanData.tenure),
            repaymentEvery: 1,
            repaymentFrequencyType: 2, // Monthly
            interestRatePerPeriod: 28, // 28% per year (CBS requirement)
            interestRateFrequencyType: 3, // Per year
            amortizationType: 1, // Equal installments
            interestType: 0, // Declining balance
            interestCalculationPeriodType: 1, // Same as repayment
            transactionProcessingStrategyCode: "mifos-standard-strategy",
            loanType: "individual", // Required field
            expectedDisbursementDate: new Date().toISOString().split('T')[0],
            submittedOnDate: new Date().toISOString().split('T')[0],
            dateFormat: "yyyy-MM-dd",
            locale: "en"
        };
        
        console.log('📄 Loan payload:', JSON.stringify(loanPayload, null, 2));
        
        // Create loan
        const loanResponse = await require('./src/services/cbs.api').maker.post('/v1/loans', loanPayload);
        
        if (loanResponse.status && loanResponse.response?.loanId) {
            const loanId = loanResponse.response.loanId;
            console.log(`✅ Loan created successfully with ID: ${loanId}`);
            
            // Approve loan
            console.log('📋 Approving loan...');
            const approvePayload = {
                approvedOnDate: new Date().toISOString().split('T')[0],
                dateFormat: "yyyy-MM-dd",
                locale: "en"
            };
            
            await require('./src/services/cbs.api').maker.post(`/v1/loans/${loanId}?command=approve`, approvePayload);
            console.log(`✅ Loan ${loanId} approved successfully`);
            
            // Disburse loan
            console.log('💸 Disbursing loan...');
            const disbursePayload = {
                actualDisbursementDate: new Date().toISOString().split('T')[0],
                dateFormat: "yyyy-MM-dd",
                locale: "en"
            };
            
            await require('./src/services/cbs.api').maker.post(`/v1/loans/${loanId}?command=disburse`, disbursePayload);
            console.log(`✅ Loan ${loanId} disbursed successfully`);
            
            return loanId;
        } else {
            throw new Error('Failed to create loan: ' + JSON.stringify(loanResponse));
        }
        
    } catch (error) {
        console.error('❌ Error creating loan:', error.message);
        throw error;
    }
}

/**
 * Update loan mapping with CBS IDs
 */
async function updateLoanMapping(clientId, loanId) {
    try {
        console.log('\n📝 Updating Loan Mapping...');
        
        const loanMappingSchema = new mongoose.Schema({}, { 
            collection: "loanmappings",
            strict: false 
        });
        const LoanMapping = mongoose.model("LoanMappingUpdate", loanMappingSchema);
        
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/miracore");
        
        const updateResult = await LoanMapping.updateOne(
            { essApplicationNumber: customerData.applicationNumber },
            {
                $set: {
                    mifosClientId: clientId,
                    mifosLoanId: loanId,
                    "metadata.clientCreatedAt": new Date().toISOString(),
                    "metadata.loanCreatedAt": new Date().toISOString(),
                    "metadata.loanApprovedAt": new Date().toISOString(),
                    "metadata.loanDisbursedAt": new Date().toISOString()
                }
            }
        );
        
        console.log('✅ Loan mapping updated:', updateResult);
        
        await mongoose.connection.close();
        
    } catch (error) {
        console.error('❌ Error updating loan mapping:', error.message);
        throw error;
    }
}

/**
 * Extract date of birth from Tanzanian NIN
 * Format: YYYYMMDDXXXXXXXX
 */
function extractDateOfBirth(nin) {
    if (!nin || nin.length < 8) {
        return "1985-06-12"; // Default fallback
    }
    
    const year = nin.substring(0, 4);
    const month = nin.substring(4, 6);
    const day = nin.substring(6, 8);
    
    return `${year}-${month}-${day}`;
}

/**
 * Main execution function
 */
async function fixClientCreation() {
    try {
        console.log('🔧 FIXING CLIENT CREATION FOR ESS1763982075940');
        console.log('='.repeat(60));
        
        console.log('📋 Customer Details:');
        console.log(`   Name: ${customerData.fullName}`);
        console.log(`   NIN: ${customerData.nin}`);
        console.log(`   Mobile: ${customerData.mobileNumber}`);
        console.log(`   Application: ${customerData.applicationNumber}`);
        console.log(`   Loan Amount: ${loanData.requestedAmount}`);
        console.log(`   Tenure: ${loanData.tenure} months\n`);
        
        // Step 1: Create client
        const clientId = await createClientInCBS();
        
        // Step 2: Create loan
        const loanId = await createLoanInCBS(clientId);
        
        // Step 3: Update loan mapping
        await updateLoanMapping(clientId, loanId);
        
        console.log('\n🎉 SUCCESS! Client creation process completed');
        console.log('='.repeat(60));
        console.log(`✅ Client ID: ${clientId}`);
        console.log(`✅ Loan ID: ${loanId}`);
        console.log(`✅ Application: ${customerData.applicationNumber}`);
        console.log('✅ Loan mapping updated with CBS IDs');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ FAILED! Client creation process failed');
        console.error('='.repeat(60));
        console.error(`Error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        process.exit(1);
    }
}

// Run the fix
fixClientCreation();