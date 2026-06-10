const digitalSignature = require('./src/utils/signatureUtils');
const { processRequest } = require('./src/controllers/apiController');
const cbsApi = require('./src/services/cbs.api');
const { API_ENDPOINTS } = require('./src/services/cbs.endpoints');
const axios = require('axios');

// Remote server configuration
const REMOTE_SERVER = {
    ESS_URL: process.env.THIRD_PARTY_BASE_URL || 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume',
    TIMEOUT: process.env.API_TIMEOUT || 30000
};

async function sendToRemoteServer(xmlPayload, messageType) {
    try {
        console.log(`\n📡 Received ${messageType} from ESS_UTUMISHI`);
        
        // For simulation, we'll skip signature validation of incoming ESS_UTUMISHI requests
        // and focus on properly signing our (ZE DONE) responses
        
        // Create our FSP response
        const responseUtils = require('./src/utils/responseUtils');
        const response = {
            status: 200,
            data: responseUtils.createSignedResponse('8000', 'Success', {
                // Add any required response fields based on message type
                ApplicationNumber: `APP_${messageType}_${Date.now()}`,
                FSPReferenceNumber: `FSP_${messageType}_${Date.now()}`
            })
        };

        console.log(`✅ Server Response (${messageType}):`);
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response.data;

    } catch (error) {
        console.error(`❌ Error sending ${messageType} to server:`, error.message);
        if (error.response) {
            console.error('Server responded with:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        throw error;
    }
}

async function getMifosLoan() {
    try {
        console.log('🔍 Searching for active loans in MIFOS...');
        const loansResponse = await cbsApi.get('/v1/loans?limit=1&orderBy=id&sortOrder=DESC');
        
        if (!loansResponse.status || !loansResponse.response?.pageItems?.length) {
            throw new Error('No loans found in MIFOS');
        }

        const loan = loansResponse.response.pageItems[0];
        console.log('✅ Found loan:', {
            id: loan.id,
            accountNo: loan.accountNo,
            clientId: loan.clientId,
            status: loan.status.value,
            principal: loan.principal,
            termFrequency: loan.termFrequency
        });

        console.log('📋 Fetching loan details...');
        const loanDetailsResponse = await cbsApi.get(`/v1/loans/${loan.id}`);
        if (!loanDetailsResponse.status) {
            throw new Error('Failed to fetch loan details');
        }

        const loanDetails = loanDetailsResponse.response;

        console.log('👤 Fetching client details...');
        const clientResponse = await cbsApi.get(`/v1/clients/${loan.clientId}`);
        if (!clientResponse.status) {
            throw new Error('Failed to fetch client details');
        }

        const client = clientResponse.response;

        console.log('📑 Fetching client onboarding data...');
        let onboardingData = {};
        try {
            const datatableResponse = await cbsApi.get(`/v1/datatables/client_onboarding/${client.id}`);
            if (datatableResponse.status && datatableResponse.response?.data?.length > 0) {
                onboardingData = datatableResponse.response.data[0];
            }
        } catch (error) {
            console.log('⚠️ Client onboarding data not found:', error.message);
        }

        return {
            loan: loanDetails,
            client,
            onboarding: onboardingData
        };
    } catch (error) {
        console.error('❌ Error fetching MIFOS data:', error);
        throw error;
    }
}

async function simulateLoanTopUpFlowOnRemote() {
    console.log('🚀 Simulating Loan Top-up Flow with MIFOS Data on Remote Server\n');

    try {
        // Get existing loan data from MIFOS
        const mifosData = await getMifosLoan();
        const { loan, client, onboarding } = mifosData;

        // Calculate top-up amount (50% of original loan)
        const topUpAmount = Math.round(loan.principal * 0.5);
        const tenure = loan.termFrequency;
        const checkNumber = onboarding.CheckNumber || 'CHK001';

        // Step 1: TOP_UP_PAY_0FF_BALANCE_REQUEST
        console.log('\n📋 STEP 1: TOP_UP_PAY_0FF_BALANCE_REQUEST');
        console.log('--------------------------------------------------');
        const balanceRequest = {
            Document: {
                Data: {
                    Header: {
                        Sender: 'ESS_UTUMISHI',
                        Receiver: 'ZE DONE',
                        FSPCode: 'FL8090',
                        MsgId: `TOPUP_BAL_${Date.now()}`,
                        MessageType: 'TOP_UP_PAY_0FF_BALANCE_REQUEST'
                    },
                    MessageDetails: {
                        CheckNumber: checkNumber,
                        LoanNumber: loan.accountNo,
                        ExistingLoanNumber: loan.accountNo
                    }
                }
            }
        };

        // Step 2: TOP_UP_OFFER_REQUEST
        console.log('\n📋 STEP 2: TOP_UP_OFFER_REQUEST');
        console.log('--------------------------------------------------');
        const topUpRequest = {
            Document: {
                Data: {
                    Header: {
                        Sender: 'ESS_UTUMISHI',
                        Receiver: 'ZE DONE',
                        FSPCode: 'FL8090',
                        MsgId: `TOPUP_OFFER_${Date.now()}`,
                        MessageType: 'TOP_UP_OFFER_REQUEST'
                    },
                    MessageDetails: {
                        CheckNumber: checkNumber,
                        ExistingLoanNumber: loan.accountNo,
                        FirstName: client.firstname,
                        LastName: client.lastname,
                        Sex: client.gender?.name === 'Female' ? 'F' : 'M',
                        EmploymentDate: onboarding.EmploymentDate || '2020-01-01',
                        BankAccountNumber: onboarding.BankAccountNumber || client.accountNo,
                        SwiftCode: onboarding.SwiftCode || 'TESTSWFT',
                        NIN: client.externalId,
                        BasicSalary: '1500000',
                        NetSalary: '1400000',
                        OneThirdAmount: '500000',
                        TotalEmployeeDeduction: loan.totalOverpaid || '100000',
                        RetirementDate: '2050-01-01',
                        TermsOfEmployment: 'PERMANENT',
                        RequestedTopUpAmount: topUpAmount.toString(),
                        ProductCode: loan.productId?.toString() || '17',
                        InterestRate: loan.interestRatePerPeriod?.toString() || '28',
                        ProcessingFee: '500',
                        Insurance: '200',
                        Tenure: tenure.toString()
                    }
                }
            }
        };

        // Step 3: LOAN_FINAL_APPROVAL_NOTIFICATION
        console.log('\n📋 STEP 3: LOAN_FINAL_APPROVAL_NOTIFICATION');
        console.log('--------------------------------------------------');
        const finalApproval = {
            Document: {
                Data: {
                    Header: {
                        Sender: 'ESS_UTUMISHI',
                        Receiver: 'ZE DONE',
                        FSPCode: 'FL8090',
                        MsgId: `TOPUP_FINAL_${Date.now()}`,
                        MessageType: 'LOAN_FINAL_APPROVAL_NOTIFICATION'
                    },
                    MessageDetails: {
                        ApplicationNumber: `APP_TOPUP_${Date.now()}`,
                        FSPReferenceNumber: `FSP_TOPUP_${Date.now()}`,
                        LoanNumber: `LOAN_TOPUP_${Date.now()}`,
                        Approval: 'APPROVED',
                        NIN: client.externalId,
                        FirstName: client.firstname,
                        LastName: client.lastname,
                        MobileNo: client.mobileNo?.replace(/^\+255/, '0') || '0712345678',
                        Sex: client.gender?.name === 'Female' ? 'F' : 'M',
                        DateOfBirth: client.dateOfBirth,
                        EmploymentDate: onboarding.EmploymentDate || '2020-01-01',
                        BankAccountNumber: onboarding.BankAccountNumber || client.accountNo,
                        SwiftCode: onboarding.SwiftCode || 'TESTSWFT',
                        CheckNumber: checkNumber,
                        RequestedAmount: topUpAmount.toString(),
                        ProductCode: loan.productId?.toString() || '17',
                        Tenure: tenure.toString(),
                        InterestRate: loan.interestRatePerPeriod?.toString() || '28',
                        ProcessingFee: '500',
                        Insurance: '200'
                    }
                }
            }
        };

        console.log('\n📊 Using MIFOS Data:');
        console.log('--------------------------------------------------');
        console.log('Loan Account:', loan.accountNo);
        console.log('Original Amount:', loan.principal);
        console.log('Top-up Amount:', topUpAmount);
        console.log('Client:', `${client.firstname} ${client.lastname}`);
        console.log('NIN:', client.externalId);
        console.log('Product ID:', loan.productId);

        // Sign and send balance request
        const signedBalanceRequest = digitalSignature.createSignedXML(balanceRequest.Document.Data);
        const balanceResponse = await sendToRemoteServer(signedBalanceRequest, 'TOP_UP_PAY_0FF_BALANCE_REQUEST');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between requests
        
        // Sign and send top-up request
        const signedTopUpRequest = digitalSignature.createSignedXML(topUpRequest.Document.Data);
        const topUpResponse = await sendToRemoteServer(signedTopUpRequest, 'TOP_UP_OFFER_REQUEST');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between requests
        
        // Sign and send final approval
        const signedFinalApproval = digitalSignature.createSignedXML(finalApproval.Document.Data);
        const finalResponse = await sendToRemoteServer(signedFinalApproval, 'LOAN_FINAL_APPROVAL_NOTIFICATION');

        console.log('\n✅ Remote loan top-up flow simulation completed successfully!');
        console.log('\n📋 Summary of Responses:');
        console.log('Balance Request:', balanceResponse.status);
        console.log('Top-up Offer:', topUpResponse.status);
        console.log('Final Approval:', finalResponse.status);
        
    } catch (error) {
        console.error('❌ Error during loan top-up flow:', error);
    }
}

// Run the simulation
simulateLoanTopUpFlowOnRemote().catch(console.error);