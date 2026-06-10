console.log('Loading modules...');
const axios = require('axios');
console.log('✅ Axios loaded');

const digitalSignature = require('./src/utils/signatureUtils');
console.log('✅ Digital signature loaded');

console.log('\n🧪 Testing basic LOAN_OFFER_REQUEST\n');

const SERVER_URL = 'http://135.181.33.13:3002/api/loan';

const testData = {
    Header: {
        Sender: 'ESS_UTUMISHI',
        Receiver: 'ZE DONE',
        FSPCode: 'FL8090',
        MsgId: `TEST_${Date.now()}`,
        MessageType: 'LOAN_OFFER_REQUEST'
    },
    MessageDetails: {
        ApplicationNumber: `ESS${Date.now()}`,
        CheckNumber: `CHK${Date.now()}`,
        FirstName: 'Test',
        LastName: 'User',
        Sex: 'M',
        NIN: '1234567890123456',
        RequestedAmount: '5000000',
        Tenure: '60'
    }
};

console.log('Creating signed XML...');
const signedXML = digitalSignature.createSignedXML(testData);
console.log('✅ XML signed\n');

console.log('Sending request...');
axios.post(SERVER_URL, signedXML, {
    headers: {
        'Content-Type': 'application/xml'
    },
    timeout: 10000
})
.then(response => {
    console.log('✅ Success:', response.status);
    console.log(response.data);
    process.exit(0);
})
.catch(error => {
    console.log('❌ Error:', error.message);
    process.exit(1);
});
