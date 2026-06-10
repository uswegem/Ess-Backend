const axios = require('axios');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/signatureUtils');

/**
 * Send LOAN_RESTRUCTURE_REQUEST_FSP to ESS_UTUMISHI
 * This is an FSP-initiated restructure request with complete loan details
 */

const loanNumber = process.argv[2] || 'LOAN1766054808065';

console.log('📤 SENDING LOAN_RESTRUCTURE_REQUEST_FSP TO UTUMISHI');
console.log('='.repeat(70));
console.log('Loan Number:', loanNumber);

// Calculate dates
const now = new Date();
const validityDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days validity
const lastRepaymentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last month
const maturityDate = new Date(now.getTime() + 18 * 30 * 24 * 60 * 60 * 1000); // 18 months from now

// Create restructure request message
const messageData = {
    Header: {
        "Sender": "ZE DONE",
        "Receiver": "ESS_UTUMISHI",
        "FSPCode": "FL8090",
        "MsgId": getMessageId("LOAN_RESTRUCTURE_REQUEST_FSP"),
        "MessageType": "LOAN_RESTRUCTURE_REQUEST_FSP"
    },
    MessageDetails: {
        "ApplicationNumber": "ESS1766062791345",
        "LoanNumber": loanNumber,
        "InstallmentAmount": "150000.00",
        "OutstandingBalance": "1800000.00",
        "PrincipalBalance": "1500000.00",
        "ValidityDate": validityDate.toISOString().replace(/\.\d{3}Z$/, ''),
        "LastRepaymentDate": lastRepaymentDate.toISOString().replace(/\.\d{3}Z$/, ''),
        "MaturityDate": maturityDate.toISOString().replace(/\.\d{3}Z$/, ''),
        "Reason": "Extended tenure request - reduce monthly installment",
        "NewInstallmentAmount": "125000.00",
        "NewInsuranceAmount": "50000.00",
        "NewProcessingFee": "30000.00",
        "NewInterestAmount": "360000.00",
        "NewPrincipalAmount": "1500000.00",
        "NewTotalAmountPayable": "1940000.00",
        "OtherCharges": "0.00",
        "NewTenure": "18",
        "ProductCode": "17",
        "DeductionCode": "FL8090",
        "FSPReferenceNumber": "FSP1766054808065"
    }
};

console.log('\n📊 RESTRUCTURE REQUEST DETAILS:');
console.log('Application Number:', messageData.MessageDetails.ApplicationNumber);
console.log('Current Monthly Installment: TZS', messageData.MessageDetails.InstallmentAmount);
console.log('New Monthly Installment: TZS', messageData.MessageDetails.NewInstallmentAmount);
console.log('Current Tenure: 12 months (assumed)');
console.log('New Tenure:', messageData.MessageDetails.NewTenure, 'months');
console.log('Outstanding Balance: TZS', messageData.MessageDetails.OutstandingBalance);
console.log('New Total Payable: TZS', messageData.MessageDetails.NewTotalAmountPayable);

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
    console.log('\n✅ SUCCESS! LOAN_RESTRUCTURE_REQUEST_FSP sent to Utumishi');
    console.log('Status Code:', response.status);
    console.log('Response Headers:', JSON.stringify(response.headers, null, 2));
    console.log('\n📥 UTUMISHI RESPONSE:');
    console.log('='.repeat(70));
    console.log(response.data);
    console.log('='.repeat(70));
    console.log('\n✅ LOAN RESTRUCTURE REQUEST DELIVERED SUCCESSFULLY!');
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
