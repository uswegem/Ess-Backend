const digitalSignature = require('./src/utils/signatureUtils');
const { generateFSPReferenceNumber, generateLoanNumber } = require('./src/utils/loanUtils');

function getMessageId(messageType) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const prefix = messageType?.split('_')[0] || 'MSG';
    return `${prefix}_ZD${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${timestamp.toString().slice(-8)}`;
}

// Recreate the exact callback data structure that was used
const callbackData = {
    Header: {
        "Sender": "ZE DONE",
        "Receiver": "ESS_UTUMISHI",
        "FSPCode": "FL8090",
        "MsgId": getMessageId("LOAN_INITIAL_APPROVAL_NOTIFICATION"),
        "MessageType": "LOAN_INITIAL_APPROVAL_NOTIFICATION"
    },
    MessageDetails: {
        "ApplicationNumber": "APP_TOPUP_1764690129178", // This was in our test
        "Reason": "Top-Up Loan Request Approved",
        "FSPReferenceNumber": "FSP1764690129178", // This was generated
        "LoanNumber": "LOAN1764690129177803", // This was generated
        "TotalAmountToPay": "2750000.00", // 2.75M calculated
        "OtherCharges": "50000.00", // 50K charges
        "Approval": "APPROVED"
    }
};

console.log('=== CALLBACK DATA STRUCTURE ===');
console.log(JSON.stringify(callbackData, null, 2));

console.log('\n=== GENERATED SIGNED XML ===');
try {
    const signedXML = digitalSignature.createSignedXML(callbackData);
    console.log(signedXML);
    
    // Also show just the Data portion that gets signed
    console.log('\n=== DATA PORTION THAT GETS SIGNED ===');
    const xml2js = require('xml2js');
    const builder = new xml2js.Builder({
        rootName: 'Document',
        renderOpts: { 
            pretty: false,
            indent: '',
            newline: '',
            allowEmpty: false,
            normalize: false,
            spacebeforeslash: '',
            trim: true
        },
        xmldec: {
            version: '1.0',
            encoding: 'UTF-8',
            standalone: false
        },
        headless: false,
        cdata: false
    });
    
    const tempDoc = { Data: callbackData };
    const xmlWithoutSignature = builder.buildObject(tempDoc);
    
    // Extract Data element
    const startTag = '<Data>';
    const endTag = '</Data>';
    const startIndex = xmlWithoutSignature.indexOf(startTag);
    const endIndex = xmlWithoutSignature.indexOf(endTag);
    const dataElement = xmlWithoutSignature.substring(startIndex, endIndex + endTag.length);
    
    console.log(dataElement);
    
} catch (error) {
    console.error('Error generating XML:', error);
}