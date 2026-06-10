const digitalSignature = require('./src/utils/signatureUtils');
const axios = require('axios');

// Remote server configuration
const SERVER_URL = 'http://135.181.33.13:3002/api/loan';

async function sendToServer(xmlPayload, messageType) {
    console.log(`\n📡 Sending ${messageType} to server...`);
    console.log('Request XML:', xmlPayload);
    
    try {
        const response = await axios({
            method: 'post',
            url: SERVER_URL,
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml',
                'User-Agent': 'Miracore-Backend/1.0'
            },
            data: xmlPayload,
            timeout: 30000,
            validateStatus: function (status) {
                return status >= 200 && status < 600; // Accept all status codes for debugging
            }
        });

        console.log(`✅ ESS Response (${messageType}):`);
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response;

    } catch (error) {
        console.error(`❌ Error sending ${messageType} to ESS:`, error.message);
        if (error.response) {
            console.error('ESS responded with:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        throw error;
    }
}

async function simulateFullLoanFlow() {
    console.log('🚀 Simulating Full Loan Flow with ESS\n');

    try {
        // Step 1: LOAN_CHARGES_REQUEST
        console.log('\n📋 STEP 1: LOAN_CHARGES_REQUEST');
        console.log('--------------------------------------------------');
        const chargesRequest = {
            Document: {
                Data: {
                    Header: {
                        Sender: 'ESS_UTUMISHI',
                        Receiver: 'ZE DONE',
                        FSPCode: 'FL8090',
                        MsgId: `CHARGES_${Date.now()}`,
                        MessageType: 'LOAN_CHARGES_REQUEST'
                    },
                    MessageDetails: {
                        CheckNumber: 'CHK001',
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
                        RequestedAmount: '5000000',
                        ProductCode: '17',
                        Tenure: '84'
                    }
                }
            }
        };

        // Send charges request
        const signedChargesRequest = digitalSignature.createSignedXML(chargesRequest.Document.Data);
        await sendToServer(signedChargesRequest, 'LOAN_CHARGES_REQUEST');
        
        // Wait before next request
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: LOAN_OFFER_REQUEST
        console.log('\n📋 STEP 2: LOAN_OFFER_REQUEST');
        console.log('--------------------------------------------------');
        const offerRequest = {
            Document: {
                Data: {
                    Header: {
                        Sender: 'ESS_UTUMISHI',
                        Receiver: 'ZE DONE',
                        FSPCode: 'FL8090',
                        MsgId: `OFFER_${Date.now()}`,
                        MessageType: 'LOAN_OFFER_REQUEST'
                    },
                    MessageDetails: {
                        CheckNumber: 'CHK001',
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
                        RequestedAmount: '5000000',
                        ProductCode: '17',
                        InterestRate: '28',
                        ProcessingFee: '500',
                        Insurance: '200',
                        Tenure: '84'
                    }
                }
            }
        };

        // Send offer request
        const signedOfferRequest = digitalSignature.createSignedXML(offerRequest.Document.Data);
        await sendToServer(signedOfferRequest, 'LOAN_OFFER_REQUEST');
        
        // Wait before final request
        await new Promise(resolve => setTimeout(resolve, 2000));

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
                        MsgId: `FINAL_${Date.now()}`,
                        MessageType: 'LOAN_FINAL_APPROVAL_NOTIFICATION'
                    },
                    MessageDetails: {
                        ApplicationNumber: `APP_${Date.now()}`,
                        FSPReferenceNumber: `FSP_${Date.now()}`,
                        LoanNumber: `LOAN_${Date.now()}`,
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
                        RequestedAmount: '5000000',
                        ProductCode: '17',
                        Tenure: '84',
                        InterestRate: '28',
                        ProcessingFee: '500',
                        Insurance: '200'
                    }
                }
            }
        };

        // Send final approval
        const signedFinalApproval = digitalSignature.createSignedXML(finalApproval.Document.Data);
        await sendToServer(signedFinalApproval, 'LOAN_FINAL_APPROVAL_NOTIFICATION');

        console.log('\n✅ ESS test flow completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during test flow:', error);
    }
}

// Run the simulation
simulateFullLoanFlow().catch(console.error);