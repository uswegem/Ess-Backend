const { generateLoanNumber, generateFSPReferenceNumber } = require('./src/utils/loanUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/signatureUtils');

// Generate loan details
const newLoanNumber = generateLoanNumber();
const fspReferenceNumber = generateFSPReferenceNumber();

// Create response with EXACT element order as specified
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

console.log('��� CORRECTED LOAN_INITIAL_APPROVAL_NOTIFICATION XML');
console.log('Element Order: ApplicationNumber → Reason → FSPReferenceNumber → LoanNumber → TotalAmountToPay → OtherCharges');
console.log('='.repeat(100));
console.log();
console.log(formatXML(signedXml));
console.log();
console.log('='.repeat(100));
console.log('✅ Corrected XML ready for Utumishi');
