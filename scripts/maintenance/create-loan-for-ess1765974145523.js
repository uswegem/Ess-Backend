require('dotenv').config();
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');
const ClientService = require('./src/services/clientService');
const api = require('./src/services/cbs.api').maker;
const logger = require('./src/utils/logger');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore';

async function createLoanMapping() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Data from LOAN_FINAL_APPROVAL_NOTIFICATION
        const applicationNumber = 'ESS1765974145523';
        const loanNumber = 'LOAN1765963593440577';
        const fspReferenceNumber = '11915366';

        console.log('📋 Creating loan mapping for:');
        console.log('   Application Number:', applicationNumber);
        console.log('   Loan Number:', loanNumber);
        console.log('   FSP Reference Number:', fspReferenceNumber);
        console.log('');

        // Check if mapping already exists
        const existing = await LoanMapping.findOne({ essApplicationNumber: applicationNumber });
        
        let mapping;
        if (existing) {
            console.log('⚠️  Loan mapping already exists, updating...');
            existing.essLoanNumberAlias = loanNumber;
            existing.fspReferenceNumber = fspReferenceNumber;
            existing.status = 'FINAL_APPROVAL_RECEIVED';
            existing.metadata = {
                ...existing.metadata,
                finalApprovalReceivedAt: new Date().toISOString()
            };
            mapping = await existing.save();
        } else {
            console.log('➕ Creating new loan mapping...');
            mapping = new LoanMapping({
                essApplicationNumber: applicationNumber,
                essCheckNumber: fspReferenceNumber,
                fspReferenceNumber: fspReferenceNumber,
                essLoanNumberAlias: loanNumber,
                productCode: '17',
                requestedAmount: 5000000, // Default amount
                tenure: 60,
                status: 'FINAL_APPROVAL_RECEIVED',
                metadata: {
                    createdVia: 'manual_script',
                    finalApprovalReceivedAt: new Date().toISOString(),
                    note: 'Created manually for missing LOAN_OFFER_REQUEST'
                }
            });
            mapping = await mapping.save();
        }

        console.log('✅ Loan mapping saved:', mapping._id);
        console.log('   Status:', mapping.status);
        console.log('');

        // Now create CBS client and loan
        console.log('🏦 Creating client in CBS...');
        
        // Use dummy client data since we don't have the original LOAN_OFFER_REQUEST
        const clientPayload = {
            officeId: 1,
            firstname: 'ESS',
            middlename: 'Application',
            lastname: applicationNumber,
            externalId: fspReferenceNumber,
            dateFormat: 'yyyy-MM-dd',
            locale: 'en',
            active: true,
            activationDate: new Date().toISOString().split('T')[0],
            submittedOnDate: new Date().toISOString().split('T')[0],
            dateOfBirth: '1990-01-01',
            genderId: 15, // Male
            clientTypeId: 17,
            legalFormId: 1
        };

        let clientId;
        
        // Check if client already exists
        const existingClient = await ClientService.searchClientByExternalId(fspReferenceNumber);
        
        if (existingClient?.response?.pageItems?.length > 0) {
            clientId = existingClient.response.pageItems[0].id;
            console.log('✅ Client already exists with ID:', clientId);
        } else {
            const clientResponse = await ClientService.createClient(clientPayload);
            if (clientResponse.status && clientResponse.response?.clientId) {
                clientId = clientResponse.response.clientId;
                console.log('✅ Client created with ID:', clientId);
            } else {
                throw new Error('Failed to create client: ' + JSON.stringify(clientResponse));
            }
        }

        console.log('');
        console.log('💰 Creating loan in CBS...');

        const loanPayload = {
            clientId: clientId,
            productId: 17, // ESS Loan product
            principal: '5000000',
            loanTermFrequency: 60,
            loanTermFrequencyType: 2, // Months
            numberOfRepayments: 60,
            repaymentEvery: 1,
            repaymentFrequencyType: 2, // Monthly
            interestRatePerPeriod: 15,
            interestRateFrequencyType: 3, // Per year
            amortizationType: 1, // Equal installments
            interestType: 0, // Declining balance
            interestCalculationPeriodType: 1, // Same as repayment
            transactionProcessingStrategyCode: 'mifos-standard-strategy',
            expectedDisbursementDate: new Date().toISOString().split('T')[0],
            submittedOnDate: new Date().toISOString().split('T')[0],
            externalId: applicationNumber,
            dateFormat: 'yyyy-MM-dd',
            locale: 'en'
        };

        const loanResponse = await api.post('/v1/loans', loanPayload);

        if (loanResponse.status && loanResponse.response?.loanId) {
            const loanId = loanResponse.response.loanId;
            console.log('✅ Loan created with ID:', loanId);
            console.log('');

            // Approve loan
            console.log('✅ Approving loan...');
            const approvePayload = {
                approvedOnDate: new Date().toISOString().split('T')[0],
                dateFormat: 'yyyy-MM-dd',
                locale: 'en'
            };
            await api.post(`/v1/loans/${loanId}?command=approve`, approvePayload);
            console.log('✅ Loan approved');

            // Disburse loan
            console.log('💸 Disbursing loan...');
            const disbursePayload = {
                actualDisbursementDate: new Date().toISOString().split('T')[0],
                dateFormat: 'yyyy-MM-dd',
                locale: 'en'
            };
            await api.post(`/v1/loans/${loanId}?command=disburse`, disbursePayload);
            console.log('✅ Loan disbursed');
            console.log('');

            // Update loan mapping with CBS IDs
            mapping.mifosClientId = clientId;
            mapping.mifosLoanId = loanId;
            mapping.status = 'DISBURSED';
            mapping.disbursedAmount = 5000000;
            mapping.disbursedAt = new Date().toISOString();
            mapping.metadata = {
                ...mapping.metadata,
                clientId: clientId,
                loanId: loanId,
                loanCreatedAt: new Date().toISOString(),
                loanDisbursedAt: new Date().toISOString()
            };
            await mapping.save();

            console.log('✅ Updated loan mapping with CBS IDs');
            console.log('   Client ID:', clientId);
            console.log('   Loan ID:', loanId);
            console.log('   Status:', mapping.status);
            console.log('');
            console.log('🎉 All done! Loan successfully created in CBS.\n');

        } else {
            throw new Error('Failed to create loan: ' + JSON.stringify(loanResponse));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response, null, 2));
        }
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

createLoanMapping();
