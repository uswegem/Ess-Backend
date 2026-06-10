const axios = require('axios');
const digitalSignature = require('./src/utils/signatureUtils');

async function testTopUpBalanceRequest() {
    console.log('🧪 Testing TOP_UP_PAY_0FF_BALANCE_REQUEST\n');
    console.log('⚠️  NOTE: This test requires an existing loan in MIFOS');
    console.log('   Update the LoanNumber field with a valid MIFOS loan ID\n');

    // Build the request with proper structure based on documentation
    const requestData = {
        Data: {
            Header: {
                Sender: 'ESS_UTUMISHI',
                Receiver: 'ZE DONE',
                FSPCode: 'FL8090',
                MsgId: `TEST_TOPUP_BAL_${Date.now()}`,
                MessageType: 'TOP_UP_PAY_0FF_BALANCE_REQUEST'
            },
            MessageDetails: {
                CheckNumber: '111276112',
                LoanNumber: '1', // ⚠️ REPLACE WITH ACTUAL MIFOS LOAN ID
                FirstName: 'Simba',
                MiddleName: 'Mapunda',
                LastName: 'Nguchiro',
                VoteCode: '32',
                VoteName: 'Watumishi',
                DeductionAmount: '300000',
                DeductionCode: 'NY908',
                DeductionName: 'Mawenzi Deduction',
                DeductionBalance: '4000800000',
                PaymentOption: 'Full payment'
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
        console.log('\n🌐 Sending request to http://135.181.33.13:3002/api/loan...');
        
        // Send to remote server
        const response = await axios.post('http://135.181.33.13:3002/api/loan', signedXml, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 30000 // 30 second timeout
        });

        console.log('\n✅ Response received');
        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers['content-type']);

        // Parse response to check message type
        const xml2js = require('xml2js');
        const parser = new xml2js.Parser({ explicitArray: false });
        const parsed = await parser.parseStringPromise(response.data);
        
        console.log('\n📊 Parsed Response Structure:');
        console.log(JSON.stringify(parsed, null, 2));

        const messageType = parsed?.Document?.Data?.Header?.MessageType;
        console.log('\n🏷️  Response Message Type:', messageType);

        if (messageType === 'LOAN_TOP_UP_BALANCE_RESPONSE') {
            console.log('\n✅ SUCCESS: Received LOAN_TOP_UP_BALANCE_RESPONSE!');
            const details = parsed.Document.Data.MessageDetails;
            console.log('\n📋 Balance Response Details:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('LoanNumber:              ', details.LoanNumber);
            console.log('FSPReferenceNumber:      ', details.FSPReferenceNumber);
            console.log('PaymentReferenceNumber:  ', details.PaymentReferenceNumber);
            console.log('TotalPayoffAmount:       ', details.TotalPayoffAmount);
            console.log('OutstandingBalance:      ', details.OutstandingBalance);
            console.log('FinalPaymentDate:        ', details.FinalPaymentDate);
            console.log('LastDeductionDate:       ', details.LastDeductionDate);
            console.log('LastPayDate:             ', details.LastPayDate);
            console.log('EndDate:                 ', details.EndDate);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } else if (messageType === 'RESPONSE') {
            const statusCode = parsed?.Document?.Data?.MessageDetails?.StatusCode;
            const statusDesc = parsed?.Document?.Data?.MessageDetails?.StatusDesc;
            console.log('\n⚠️  Received generic RESPONSE (not LOAN_TOP_UP_BALANCE_RESPONSE)');
            console.log('StatusCode:', statusCode);
            console.log('StatusDesc:', statusDesc);
            
            if (statusCode === '8005') {
                console.log('\n❌ ERROR: Loan not found in MIFOS');
                console.log('💡 TIP: Update the LoanNumber in the test file with a valid MIFOS loan ID');
            }
        } else {
            console.log('\n⚠️  WARNING: Unexpected response type:', messageType);
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
console.log('  TOP_UP_PAY_0FF_BALANCE_REQUEST Test');
console.log('═══════════════════════════════════════════════════════════════\n');

testTopUpBalanceRequest()
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
