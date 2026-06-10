const digitalSignature = require('./src/utils/signatureUtils');
const { processRequest } = require('./src/controllers/apiController');
const cbsApi = require('./src/services/cbs.api');
const { API_ENDPOINTS } = require('./src/services/cbs.endpoints');

async function getMifosLoan() {
    try {
        // Search for active loans
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

        // Get loan details
        console.log('📋 Fetching loan details...');
        const loanDetailsResponse = await cbsApi.get(`/v1/loans/${loan.id}`);
        if (!loanDetailsResponse.status) {
            throw new Error('Failed to fetch loan details');
        }

        const loanDetails = loanDetailsResponse.response;

        // Get client details
        console.log('👤 Fetching client details...');
        const clientResponse = await cbsApi.get(`/v1/clients/${loan.clientId}`);
        if (!clientResponse.status) {
            throw new Error('Failed to fetch client details');
        }

        const client = clientResponse.response;

        // Get client datatable info (for additional details)
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

async function simulateLoanTopUpFlow() {
    console.log('🚀 Simulating Loan Top-up Flow with MIFOS Data\n');

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
                        BasicSalary: '1500000',  // Example value as not in MIFOS
                        NetSalary: '1400000',    // Example value
                        OneThirdAmount: '500000', // Example value
                        TotalEmployeeDeduction: loan.totalOverpaid || '100000',
                        RetirementDate: '2050-01-01', // Example value
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
        console.log('\n📤 BALANCE REQUEST XML:');
        console.log(signedBalanceRequest);
        
        // Sign and send top-up request
        const signedTopUpRequest = digitalSignature.createSignedXML(topUpRequest.Document.Data);
        console.log('\n📤 TOP-UP REQUEST XML:');
        console.log(signedTopUpRequest);
        
        // Sign and send final approval
        const signedFinalApproval = digitalSignature.createSignedXML(finalApproval.Document.Data);
        console.log('\n📤 FINAL APPROVAL XML:');
        console.log(signedFinalApproval);

        console.log('\n✅ Loan top-up flow simulation completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during loan top-up flow:', error);
    }
}

// Run the simulation
simulateLoanTopUpFlow().catch(console.error);