const digitalSignature = require('./src/utils/signatureUtils');
const { processRequest } = require('./src/controllers/apiController');

async function simulateLoanTopUpFlow() {
    console.log('🚀 Simulating Loan Top-up Flow\n');

    // Step 1: TOP_UP_PAY_0FF_BALANCE_REQUEST
    console.log('📋 STEP 1: TOP_UP_PAY_0FF_BALANCE_REQUEST');
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
                    CheckNumber: 'CHK001',
                    LoanNumber: 'LOAN001',
                    ExistingLoanNumber: 'LOAN001'
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
                    CheckNumber: 'CHK001',
                    ExistingLoanNumber: 'LOAN001',
                    FirstName: 'John',
                    LastName: 'Doe',
                    Sex: 'M',
                    EmploymentDate: '2020-01-01',
                    BankAccountNumber: '1234567890',
                    SwiftCode: 'TESTSWFT',
                    NIN: '1234567890123456',
                    BasicSalary: '1500000',
                    NetSalary: '1400000',
                    OneThirdAmount: '500000',
                    TotalEmployeeDeduction: '100000',
                    RetirementDate: '2050-01-01',
                    TermsOfEmployment: 'PERMANENT',
                    RequestedTopUpAmount: '2000000',
                    ProductCode: '17',
                    InterestRate: '28',
                    ProcessingFee: '500',
                    Insurance: '200',
                    Tenure: '24'
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
                    NIN: '1234567890123456',
                    FirstName: 'John',
                    LastName: 'Doe',
                    MobileNo: '0712345678',
                    Sex: 'M',
                    DateOfBirth: '1990-01-01',
                    EmploymentDate: '2020-01-01',
                    BankAccountNumber: '1234567890',
                    SwiftCode: 'TESTSWFT',
                    CheckNumber: 'CHK001',
                    RequestedAmount: '2000000',
                    ProductCode: '17',
                    Tenure: '24',
                    InterestRate: '28',
                    ProcessingFee: '500',
                    Insurance: '200'
                }
            }
        }
    };

    try {
        // Sign and send balance request
        const signedBalanceRequest = digitalSignature.createSignedXML(balanceRequest.Document.Data);
        console.log('📤 BALANCE REQUEST XML:');
        console.log(signedBalanceRequest);
        
        // Sign and send top-up request
        const signedTopUpRequest = digitalSignature.createSignedXML(topUpRequest.Document.Data);
        console.log('📤 TOP-UP REQUEST XML:');
        console.log(signedTopUpRequest);
        
        // Sign and send final approval
        const signedFinalApproval = digitalSignature.createSignedXML(finalApproval.Document.Data);
        console.log('📤 FINAL APPROVAL XML:');
        console.log(signedFinalApproval);

        console.log('\n✅ Loan top-up flow simulation completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during loan top-up flow:', error);
    }
}

// Run the simulation
simulateLoanTopUpFlow().catch(console.error);