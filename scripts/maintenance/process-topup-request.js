const axios = require('axios');
const { generateLoanNumber, generateFSPReferenceNumber } = require('./src/utils/loanUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/signatureUtils');

console.log('Ì≥• Processing TOP_UP_OFFER_REQUEST from Utumishi');
console.log('Check Number: 110977381');
console.log('Application: ESS1764693863532');
console.log('Customer: MARRY EDWARD NTIGA');
console.log('Requested Amount: TZS 14,000,000');

// Generate approval response
const newLoanNumber = generateLoanNumber();
const fspReferenceNumber = generateFSPReferenceNumber();

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
        "CheckNumber": "110977381",
        "Reason": "Top-Up Loan Request Approved",
        "FSPReferenceNumber": fspReferenceNumber,
        "LoanNumber": newLoanNumber,
        "ApprovedAmount": "14000000.00",
        "TotalAmountToPay": "32305187.95",
        "OtherCharges": "509585.49",
        "MonthlyInstallment": "342341.39",
        "Tenure": "96",
        "InterestRate": "18.0",
        "ProcessingFee": "291191.71",
        "Insurance": "218393.78",
        "Approval": "APPROVED",
        "ApprovalDate": new Date().toISOString().split('T')[0],
        "DisbursementAccount": "9120003342458"
    }
};

console.log('\\n‚úÖ LOAN APPROVED:');
console.log('New Loan Number:', newLoanNumber);
console.log('FSP Reference:', fspReferenceNumber);
console.log('\\nÌ≥§ Sending callback to Utumishi...');

const signedXml = digitalSignature.createSignedXML(callbackResponse);
const callbackUrl = 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume';

axios.post(callbackUrl, signedXml, {
    headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml'
    },
    timeout: 30000
}).then(response => {
    console.log('‚úÖ Callback sent successfully!');
    console.log('Status:', response.status);
    console.log('Response:', response.data);
}).catch(error => {
    console.log('‚ùå Error sending callback:', error.message);
    if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
    }
});
