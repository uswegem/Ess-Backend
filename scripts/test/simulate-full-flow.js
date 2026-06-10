const digitalSignature = require('./src/utils/signatureUtils');
const { processRequest } = require('./src/controllers/apiController');
const cbsApi = require('./src/services/cbs.api');
const responseUtils = require('./src/utils/responseUtils');

async function sendAcknowledgment(originalRequest, messageType) {
    console.log(`\n📤 Sending acknowledgment for ${messageType}`);
    const response = responseUtils.createSignedResponse('8000', 'Success', {
        ApplicationNumber: originalRequest.Document.Data.MessageDetails.ApplicationNumber || `APP_${Date.now()}`,
        FSPReferenceNumber: `FSP_${Date.now()}`
    });
    console.log('Acknowledgment sent:', response);
    return response;
}

async function sendCallback(requestData, callbackType) {
    console.log(`\n📤 Sending callback: ${callbackType}`);
    
    const callbackData = {
        Document: {
            Data: {
                Header: {
                    Sender: 'ZE DONE',
                    Receiver: 'ESS_UTUMISHI',
                    FSPCode: 'FL8090',
                    MsgId: `${callbackType}_${Date.now()}`,
                    MessageType: callbackType
                },
                MessageDetails: {
                    ApplicationNumber: requestData.Document.Data.MessageDetails.ApplicationNumber || `APP_${Date.now()}`,
                    FSPReferenceNumber: `FSP_${Date.now()}`,
                    LoanNumber: requestData.Document.Data.MessageDetails.LoanNumber,
                    NIN: requestData.Document.Data.MessageDetails.NIN,
                    FirstName: requestData.Document.Data.MessageDetails.FirstName,
                    LastName: requestData.Document.Data.MessageDetails.LastName,
                    Amount: requestData.Document.Data.MessageDetails.NewLoanAmount,
                    ProductCode: requestData.Document.Data.MessageDetails.ProductCode,
                    Tenure: requestData.Document.Data.MessageDetails.Tenure,
                    DisbursementDate: new Date().toISOString().split('T')[0],
                    Status: 'APPROVED'
                }
            }
        }
    };

    const signedCallback = digitalSignature.createSignedXML(callbackData.Document.Data);
    console.log('Callback sent:', signedCallback);
    return signedCallback;
}

async function simulateFullFlow() {
    console.log('🚀 Simulating Complete Loan Flow with Callbacks\n');

    try {
        // Step 1: Handle LOAN_OFFER_REQUEST
        console.log('\n📋 STEP 1: Receive LOAN_OFFER_REQUEST');
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
                        ApplicationNumber: `APP_${Date.now()}`,
                        LoanNumber: 'LOAN001',
                        FirstName: 'John',
                        LastName: 'Doe',
                        NIN: '1234567890123456',
                        Amount: '6000000',
                        ProductCode: '17',
                        Tenure: '84'
                    }
                }
            }
        };

        // Send immediate acknowledgment
        await sendAcknowledgment(offerRequest, 'LOAN_OFFER_REQUEST');

        // Process the request and send callback
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
        await sendCallback(offerRequest, 'LOAN_INITIAL_APPROVAL_NOTIFICATION');

        // Step 2: Handle LOAN_FINAL_APPROVAL_NOTIFICATION
        console.log('\n📋 STEP 2: Receive LOAN_FINAL_APPROVAL_NOTIFICATION');
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
                        LoanNumber: 'LOAN001',
                        FirstName: 'John',
                        LastName: 'Doe',
                        NIN: '1234567890123456',
                        Amount: '6000000',
                        ProductCode: '17',
                        Tenure: '84'
                    }
                }
            }
        };

        // Send immediate acknowledgment
        await sendAcknowledgment(finalApproval, 'LOAN_FINAL_APPROVAL_NOTIFICATION');

        // Process the approval and send disbursement notification
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
        await sendCallback(finalApproval, 'LOAN_DISBURSEMENT_NOTIFICATION');

        console.log('\n✅ Full flow simulation completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during flow:', error);
    }
}

// Run the simulation
simulateFullFlow().catch(console.error);