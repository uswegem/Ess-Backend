const axios = require('axios');
const digitalSignature = require('./src/utils/signatureUtils');

async function testLoanCancellation() {
    console.log('🧪 Testing LOAN_CANCELLATION_NOTIFICATION\n');
    console.log('⚠️  NOTE: This test requires an existing loan application that is not yet disbursed');
    console.log('   Update the ApplicationNumber field with a valid application number\n');

    // Build the request based on documentation structure
    const requestData = {
        Data: {
            Header: {
                Sender: 'ESS_UTUMISHI',
                Receiver: 'ZE DONE',
                FSPCode: 'FL8090',
                MsgId: `TEST_CANCEL_${Date.now()}`,
                MessageType: 'LOAN_CANCELLATION_NOTIFICATION'
            },
            MessageDetails: {
                ApplicationNumber: '202501010001', // ⚠️ REPLACE WITH ACTUAL APPLICATION NUMBER
                Reason: 'Employee changed their mind',
                FSPReferenceNumber: 'FSP_REF_001', // Optional
                LoanNumber: '1' // Optional
            }
        }
    };

    console.log('📤 Request Data:');
    console.log(JSON.stringify(requestData, null, 2));

    // Sign the request
    const signedXml = digitalSignature.createSignedXML(requestData.Data);
    console.log('\n📝 Signed XML (first 500 chars):');
    console.log(signedXml.substring(0, 500) + '...');

    try {
        console.log('\n🌐 Sending request to http://localhost:3002/api/loan...');
        
        const response = await axios.post('http://localhost:3002/api/loan', signedXml, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 30000
        });

        console.log('\n✅ Response received');
        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers['content-type']);

        // Parse response
        const xml2js = require('xml2js');
        const parser = new xml2js.Parser({ explicitArray: false });
        const parsed = await parser.parseStringPromise(response.data);
        
        console.log('\n📊 Parsed Response:');
        console.log(JSON.stringify(parsed, null, 2));

        const messageType = parsed?.Document?.Data?.Header?.MessageType;
        const responseCode = parsed?.Document?.Data?.MessageDetails?.ResponseCode;
        const description = parsed?.Document?.Data?.MessageDetails?.Description;

        console.log('\n🏷️  Response Details:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('MessageType:    ', messageType);
        console.log('ResponseCode:   ', responseCode);
        console.log('Description:    ', description);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (messageType === 'RESPONSE' && responseCode === '8000') {
            console.log('\n✅ SUCCESS: Loan cancellation processed successfully!');
        } else if (responseCode === '8004') {
            console.log('\n⚠️  ERROR: Loan application not found');
            console.log('💡 TIP: Update the ApplicationNumber with a valid application');
        } else if (responseCode === '8006') {
            console.log('\n⚠️  ERROR: Loan cannot be cancelled in current status');
            console.log('💡 TIP: Loan may already be disbursed');
        } else {
            console.log('\n⚠️  WARNING: Unexpected response');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('\nResponse Details:');
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 TIP: Make sure the server is running on port 3002');
            console.error('   Run: pm2 start ecosystem.config.js');
        }
    }
}

// Run the test
console.log('═══════════════════════════════════════════════════════════════');
console.log('  LOAN_CANCELLATION_NOTIFICATION Test');
console.log('═══════════════════════════════════════════════════════════════\n');

testLoanCancellation()
    .then(() => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('  Test execution completed');
        console.log('═══════════════════════════════════════════════════════════════\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test execution failed:', error);
        process.exit(1);
    });
