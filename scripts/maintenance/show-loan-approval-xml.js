const { generateLoanNumber, generateFSPReferenceNumber } = require('./src/utils/loanUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/signatureUtils');

console.log('Ì≥ã GENERATING LOAN_INITIAL_APPROVAL_NOTIFICATION XML');
console.log('='.repeat(60));

// Generate loan details for the Utumishi TOP_UP request
const newLoanNumber = generateLoanNumber();
const fspReferenceNumber = generateFSPReferenceNumber();

// Response data structure based on the TOP_UP_OFFER_REQUEST from Utumishi
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
        "Approval": "APPROVED",
        "LoanNumber": newLoanNumber,
        "ApprovedAmount": "14000000.00",
        "TotalAmountToPay": "32305187.95", 
        "OtherCharges": "509585.49",
        "MonthlyInstallment": "342341.39",
        "Tenure": "96",
        "InterestRate": "18.0",
        "ProcessingFee": "291191.71",
        "Insurance": "218393.78",
        "ApprovalDate": new Date().toISOString().split('T')[0],
        "DisbursementAccount": "9120003342458"
    }
};

console.log('\nÌ≥Ñ LOAN APPROVAL DETAILS:');
console.log('Customer: MARRY EDWARD NTIGA');
console.log('Check Number: 110977381');
console.log('Application: ESS1764693863532');
console.log('New Loan Number:', newLoanNumber);
console.log('FSP Reference:', fspReferenceNumber);
console.log('Requested Amount: TZS 14,000,000');
console.log('Settlement Amount: TZS 11,690,000 (existing loan)');

console.log('\nÌ≥ã RAW JSON STRUCTURE:');
console.log(JSON.stringify(callbackResponse, null, 2));

console.log('\nÌ≥ã SIGNED XML THAT WILL BE SENT:');
console.log('='.repeat(60));

try {
    const signedXml = digitalSignature.createSignedXML(callbackResponse);
    
    // Pretty print the XML
    console.log(signedXml);
    
    console.log('\n='.repeat(60));
    console.log('‚úÖ XML Generated Successfully');
    console.log('Ì≥§ Ready to send to: http://154.118.230.140:9802/ess-loans/mvtyztwq/consume');
    
} catch (error) {
    console.error('‚ùå Error generating XML:', error.message);
}
