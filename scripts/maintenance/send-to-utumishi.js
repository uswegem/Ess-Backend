const axios = require('axios');
const { generateLoanNumber, generateFSPReferenceNumber } = require('./src/utils/loanUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/signatureUtils');

console.log('Ì≥§ SENDING LOAN_INITIAL_APPROVAL_NOTIFICATION TO UTUMISHI');
console.log('='.repeat(70));

// Generate loan details
const newLoanNumber = generateLoanNumber();
const fspReferenceNumber = generateFSPReferenceNumber();

// Create response with correct element order
const callbackResponse = {
    Header: {
        "Sender": "ZE DONE",
        "Receiver": "ESS_UTUMISHI", 
        "FSPCode": "FL8090",
        "MsgId": getMessageId("LOAN_INITIAL_APPROVAL_NOTIFICATION"),
        "MessageType": "LOAN_INITIAL_APPROVAL_NOTIFICATION"
    },
    MessageDetails: {
        "ApplicationNumber": "ESS1764693863532",
        "Reason": "Top-Up Loan Request Approved",
        "FSPReferenceNumber": fspReferenceNumber,
        "LoanNumber": newLoanNumber,
        "TotalAmountToPay": "32305187.95",
        "OtherCharges": "509585.49"
    }
};

console.log('Ì≤∞ LOAN DETAILS:');
console.log('Customer: MARRY EDWARD NTIGA');
console.log('Application:', callbackResponse.MessageDetails.ApplicationNumber);
console.log('New Loan Number:', newLoanNumber);
console.log('FSP Reference:', fspReferenceNumber);
console.log('Total Amount to Pay: TZS', callbackResponse.MessageDetails.TotalAmountToPay);
console.log('Other Charges: TZS', callbackResponse.MessageDetails.OtherCharges);

console.log('\nÌ≥ã Generating signed XML...');
const signedXml = digitalSignature.createSignedXML(callbackResponse);

console.log('‚úÖ XML generated successfully');
console.log('\nÌ≥§ Sending to Utumishi...');
console.log('URL: http://154.118.230.140:9802/ess-loans/mvtyztwq/consume');

const callbackUrl = 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume';

axios.post(callbackUrl, signedXml, {
    headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml'
    },
    timeout: 30000
}).then(response => {
    console.log('\nÌæâ SUCCESS! Callback sent to Utumishi');
    console.log('Status Code:', response.status);
    console.log('Response Headers:', JSON.stringify(response.headers, null, 2));
    console.log('\nÌ≥ã UTUMISHI RESPONSE:');
    console.log('='.repeat(50));
    console.log(response.data);
    console.log('='.repeat(50));
    console.log('\n‚úÖ LOAN APPROVAL NOTIFICATION DELIVERED SUCCESSFULLY!');
}).catch(error => {
    console.log('\n‚ùå ERROR sending to Utumishi:', error.message);
    if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Status Text:', error.response.statusText);
        console.log('Headers:', JSON.stringify(error.response.headers, null, 2));
        console.log('Response Data:', error.response.data);
    } else if (error.request) {
        console.log('No response received from Utumishi server');
        console.log('Request details:', error.request);
    } else {
        console.log('Error setting up request:', error.message);
    }
});
