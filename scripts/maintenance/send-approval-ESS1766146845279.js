const axios = require('axios');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/signatureUtils');
const { generateLoanNumber, generateFSPReferenceNumber } = require('./src/utils/loanUtils');

/**
 * Send LOAN_INITIAL_APPROVAL_NOTIFICATION for ESS1766146845279
 */

const applicationNumber = 'ESS1766146845279';
const requestedAmount = 500000.01;
const tenure = 96;
const interestRate = 716572.77;
const processingFee = 11398.96;
const insurance = 8549.22;

console.log('📤 SENDING LOAN_INITIAL_APPROVAL_NOTIFICATION');
console.log('='.repeat(70));
console.log('Application Number:', applicationNumber);
console.log('Requested Amount:', requestedAmount);
console.log('Tenure:', tenure, 'months');

// Calculate loan details
const otherCharges = processingFee + insurance;
const totalAmountToPay = requestedAmount + interestRate + otherCharges;

console.log('\n📊 LOAN DETAILS:');
console.log('Requested Amount:', requestedAmount.toFixed(2));
console.log('Interest Rate:', interestRate.toFixed(2));
console.log('Processing Fee:', processingFee.toFixed(2));
console.log('Insurance:', insurance.toFixed(2));
console.log('Other Charges:', otherCharges.toFixed(2));
console.log('Total Amount to Pay:', totalAmountToPay.toFixed(2));

// Generate loan details
const newLoanNumber = generateLoanNumber();
const newFspReferenceNumber = generateFSPReferenceNumber();

console.log('\n🆕 GENERATED DETAILS:');
console.log('Loan Number:', newLoanNumber);
console.log('FSP Reference:', newFspReferenceNumber);

// Create approval notification
const messageData = {
    Header: {
        "Sender": "ZE DONE",
        "Receiver": "ESS_UTUMISHI",
        "FSPCode": "FL8090",
        "MsgId": getMessageId("LOAN_INITIAL_APPROVAL_NOTIFICATION"),
        "MessageType": "LOAN_INITIAL_APPROVAL_NOTIFICATION"
    },
    MessageDetails: {
        "ApplicationNumber": applicationNumber,
        "Reason": "Loan Application Approved",
        "FSPReferenceNumber": newFspReferenceNumber,
        "LoanNumber": newLoanNumber,
        "TotalAmountToPay": totalAmountToPay.toFixed(2),
        "OtherCharges": otherCharges.toFixed(2),
        "Approval": "APPROVED"
    }
};

console.log('\n📋 NOTIFICATION DETAILS:');
console.log(JSON.stringify(messageData, null, 2));

console.log('\n🔐 Generating signed XML...');
const signedXml = digitalSignature.createSignedXML(messageData);

console.log('✅ XML generated successfully');
console.log('\n📄 XML PAYLOAD:');
console.log('='.repeat(70));
console.log(signedXml);
console.log('='.repeat(70));

console.log('\n📤 Sending to Utumishi...');
console.log('URL: http://154.118.230.140:9802/ess-loans/mvtyztwq/consume');

const callbackUrl = 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume';

axios.post(callbackUrl, signedXml, {
    headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml'
    },
    timeout: 30000
}).then(response => {
    console.log('\n✅ SUCCESS! LOAN_INITIAL_APPROVAL_NOTIFICATION sent');
    console.log('Status Code:', response.status);
    console.log('Response Headers:', JSON.stringify(response.headers, null, 2));
    console.log('\n📥 UTUMISHI RESPONSE:');
    console.log('='.repeat(70));
    console.log(response.data);
    console.log('='.repeat(70));
    console.log('\n✅ LOAN APPROVAL NOTIFICATION DELIVERED SUCCESSFULLY!');
}).catch(error => {
    console.log('\n❌ ERROR sending to Utumishi:', error.message);
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
