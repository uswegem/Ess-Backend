const { generateLoanNumber, generateFSPReferenceNumber } = require('./src/utils/loanUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/signatureUtils');

// Generate loan details
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

// Generate the signed XML
const signedXml = digitalSignature.createSignedXML(callbackResponse);

// Function to format XML with proper indentation
function formatXML(xml) {
    const PADDING = ' '.repeat(2);
    const reg = /(>)(<)(\/*)/g;
    let formatted = xml.replace(reg, '$1\n$2$3');
    
    let pad = 0;
    return formatted.split('\n').map(function(line) {
        let indent = 0;
        if (line.match(/.+<\/\w[^>]*>$/)) {
            indent = 0;
        } else if (line.match(/^<\/\w/) && pad != 0) {
            pad -= 1;
        } else if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1;
        } else {
            indent = 0;
        }
        
        const padding = PADDING.repeat(pad);
        pad += indent;
        return padding + line;
    }).join('\n');
}

console.log('í³‹ LOAN_INITIAL_APPROVAL_NOTIFICATION XML');
console.log('='.repeat(80));
console.log();
console.log(formatXML(signedXml));
console.log();
console.log('='.repeat(80));
console.log('âœ… Ready to send to Utumishi at: http://154.118.230.140:9802/ess-loans/mvtyztwq/consume');
