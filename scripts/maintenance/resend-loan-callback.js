require('dotenv').config();
const xml2js = require('xml2js');
const axios = require('axios');
const digitalSignature = require('./src/utils/signatureUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');

// Loan data from the recent LOAN_OFFER_REQUEST
const loanData = {
    applicationNumber: 'ESS1765974145523',
    checkNumber: '11915366',
    loanNumber: 'LOAN1765963593440577',
    totalAmountToPay: '2257260.48',
    otherCharges: '50000.00',
    reason: 'Loan Request Approved',
    approval: 'APPROVED'
};

const builder = new xml2js.Builder({
    rootName: 'Document',
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
    xmldec: { version: '1.0', encoding: 'UTF-8', standalone: 'no' }
});

async function sendCallback() {
    try {
        // Build the callback data
        const messageId = getMessageId('LOAN_INITIAL_APPROVAL_NOTIFICATION');
        
        const callbackData = {
            Header: {
                Sender: 'ZE DONE',
                Receiver: 'ESS_UTUMISHI',
                FSPCode: 'FL8090',
                MsgId: messageId,
                MessageType: 'LOAN_INITIAL_APPROVAL_NOTIFICATION'
            },
            MessageDetails: {
                ApplicationNumber: loanData.applicationNumber,
                Reason: loanData.reason,
                FSPReferenceNumber: loanData.checkNumber,
                LoanNumber: loanData.loanNumber,
                TotalAmountToPay: loanData.totalAmountToPay,
                OtherCharges: loanData.otherCharges,
                Approval: loanData.approval
            }
        };

        // Build XML
        const dataElement = {
            Data: callbackData
        };
        
        let xmlData = builder.buildObject(dataElement);
        
        // Extract just the Data element
        const dataMatch = xmlData.match(/<Data>[\s\S]*<\/Data>/);
        const dataXml = dataMatch ? dataMatch[0] : xmlData;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📄 XML DATA TO BE SIGNED:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(dataXml);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Sign the data
        console.log('🔐 Signing the XML...');
        const signature = digitalSignature.generateSignature(dataXml);
        
        // Build final signed document
        const finalXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><Document><Data><Header><Sender>ZE DONE</Sender><Receiver>ESS_UTUMISHI</Receiver><FSPCode>FL8090</FSPCode><MsgId>${messageId}</MsgId><MessageType>LOAN_INITIAL_APPROVAL_NOTIFICATION</MessageType></Header><MessageDetails><ApplicationNumber>${loanData.applicationNumber}</ApplicationNumber><Reason>${loanData.reason}</Reason><FSPReferenceNumber>${loanData.checkNumber}</FSPReferenceNumber><LoanNumber>${loanData.loanNumber}</LoanNumber><TotalAmountToPay>${loanData.totalAmountToPay}</TotalAmountToPay><OtherCharges>${loanData.otherCharges}</OtherCharges><Approval>${loanData.approval}</Approval></MessageDetails></Data><Signature>${signature}</Signature></Document>`;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📤 FINAL SIGNED XML TO BE SENT:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(finalXml);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Send the callback
        const callbackUrl = 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume';
        
        console.log('📤 Sending callback to:', callbackUrl);
        console.log('⏱️  Request timeout: 30 seconds\n');

        const response = await axios.post(callbackUrl, finalXml, {
            headers: {
                'Content-Type': 'application/xml',
                'X-Request-ID': `${Date.now()}-callback-resend`
            },
            timeout: 30000
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ CALLBACK SENT SUCCESSFULLY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Status:', response.status, response.statusText);
        console.log('Response Headers:', JSON.stringify(response.headers, null, 2));
        console.log('\nResponse Data:');
        console.log(response.data);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ERROR SENDING CALLBACK');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received');
            console.error('Request:', error.request);
        } else {
            console.error('Error:', error.message);
        }
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        process.exit(1);
    }
}

sendCallback();
