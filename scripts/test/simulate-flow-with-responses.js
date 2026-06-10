const thirdPartyService = require('./src/services/thirdPartyService');
const signatureUtils = require('./src/utils/signatureUtils');

async function simulateFlow() {
    try {
        // Step 1: LOAN_CHARGES_REQUEST
        console.log('\n📋 STEP 1: LOAN_CHARGES_REQUEST');
        const chargesRequest = {
            Header: {
                Sender: 'ZE DONE',
                Receiver: 'ESS_UTUMISHI',
                FSPCode: 'FL8090',
                MsgId: `ESS${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
                MessageType: 'LOAN_CHARGES_REQUEST'
            },
            MessageDetails: {
                ApplicationNumber: 'APP123',
                FSPReferenceNumber: 'FSP123',
                LoanAmount: 5000,
                CustomerId: 'CUS123',
                CustomerName: 'John Doe',
                LoanProduct: 'Personal Loan',
                LoanTenure: 12,
                InterestRate: 15,
                CustomerType: 'EMPLOYEE'
            }
        };

        const signedChargesRequest = await signatureUtils.createSignedXML(chargesRequest);
        console.log('Sending LOAN_CHARGES_REQUEST...');
        const chargesResponse = await thirdPartyService.forwardToThirdParty(signedChargesRequest, 'LOAN_CHARGES_REQUEST');
        console.log('\n✅ Response received for LOAN_CHARGES_REQUEST:');
        console.log(chargesResponse);

        // Wait for 2 seconds before next request
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: LOAN_OFFER_REQUEST
        console.log('\n📋 STEP 2: LOAN_OFFER_REQUEST');
        const offerRequest = {
            Header: {
                Sender: 'ZE DONE',
                Receiver: 'ESS_UTUMISHI',
                FSPCode: 'FL8090',
                MsgId: `ESS${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
                MessageType: 'LOAN_OFFER_REQUEST'
            },
            MessageDetails: {
                ApplicationNumber: 'APP123',
                FSPReferenceNumber: 'FSP123',
                LoanAmount: 5000,
                CustomerId: 'CUS123',
                CustomerName: 'John Doe',
                LoanProduct: 'Personal Loan',
                LoanTenure: 12,
                InterestRate: 15,
                ProcessingFee: 100,
                InsuranceFee: 50,
                TotalCharges: 150,
                MonthlyRepayment: 458.33,
                CustomerType: 'EMPLOYEE',
                AcceptedTerms: true
            }
        };

        const signedOfferRequest = await signatureUtils.createSignedXML(offerRequest);
        console.log('Sending LOAN_OFFER_REQUEST...');
        const offerResponse = await thirdPartyService.forwardToThirdParty(signedOfferRequest, 'LOAN_OFFER_REQUEST');
        console.log('\n✅ Response received for LOAN_OFFER_REQUEST:');
        console.log(offerResponse);

        // Wait for 2 seconds before next request
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3: LOAN_FINAL_APPROVAL_NOTIFICATION
        console.log('\n📋 STEP 3: LOAN_FINAL_APPROVAL_NOTIFICATION');
        const finalApproval = {
            Header: {
                Sender: 'ZE DONE',
                Receiver: 'ESS_UTUMISHI',
                FSPCode: 'FL8090',
                MsgId: `ESS${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
                MessageType: 'LOAN_FINAL_APPROVAL_NOTIFICATION'
            },
            MessageDetails: {
                ApplicationNumber: 'APP123',
                FSPReferenceNumber: 'FSP123',
                LoanNumber: 'LOAN123',
                Approval: true,
                Reason: 'All checks passed',
                CustomerId: 'CUS123',
                CustomerName: 'John Doe',
                LoanAmount: 5000,
                LoanTenure: 12,
                InterestRate: 15
            }
        };

        const signedFinalApproval = await signatureUtils.createSignedXML(finalApproval);
        console.log('Sending LOAN_FINAL_APPROVAL_NOTIFICATION...');
        const finalResponse = await thirdPartyService.forwardToThirdParty(signedFinalApproval, 'LOAN_FINAL_APPROVAL_NOTIFICATION');
        console.log('\n✅ Response received for LOAN_FINAL_APPROVAL_NOTIFICATION:');
        console.log(finalResponse);

    } catch (error) {
        console.error('Error during simulation:', error);
    }
}

// Run the simulation
simulateFlow();