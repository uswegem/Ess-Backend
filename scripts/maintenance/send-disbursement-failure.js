const axios = require('axios');
const digitalSignature = require('./src/utils/signatureUtils');
require('dotenv').config();

// Loan details from the recent LOAN_FINAL_APPROVAL_NOTIFICATION we processed
const loanDetails = {
    applicationNumber: "ESS1764693863532",
    loanNumber: "LOAN1764751304978670",
    fspReferenceNumber: "FSP1764751304978",
    msgId: "075196f7d03f11f09e546b0fca61ccba" // Original message ID from the approval
};

/**
 * Create LOAN_DISBURSEMENT_FAILURE_NOTIFICATION message
 */
function createDisbursementFailureNotification() {
    const messageData = {
        Header: {
            "Sender": process.env.FSP_NAME || "ZE DONE",
            "Receiver": "ESS_UTUMISHI", 
            "FSPCode": process.env.FSP_CODE || "FL8090",
            "MsgId": `FAIL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "MessageType": "LOAN_DISBURSEMENT_FAILURE_NOTIFICATION"
        },
        MessageDetails: {
            "ApplicationNumber": loanDetails.applicationNumber,
            "Reason": "Technical issues"
        }
    };

    return messageData;
}

/**
 * Send the disbursement failure notification
 */
async function sendDisbursementFailureNotification() {
    try {
        console.log('❌ Creating LOAN_DISBURSEMENT_FAILURE_NOTIFICATION...\n');
        
        // Create the notification data
        const notificationData = createDisbursementFailureNotification();
        
        console.log('📋 Failure Notification Details:');
        console.log('=================================');
        console.log(`Application Number: ${notificationData.MessageDetails.ApplicationNumber}`);
        console.log(`Failure Reason: ${notificationData.MessageDetails.Reason}\n`);
        
        // Create signed XML
        console.log('🔐 Creating signed XML...');
        const signedXML = digitalSignature.createSignedXML(notificationData);
        
        console.log('📄 Generated XML Message:');
        console.log('='.repeat(70));
        console.log(signedXML);
        console.log('='.repeat(70));
        
        // Get callback URL from environment
        const callbackUrl = process.env.UTUMISHI_CALLBACK_URL || 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume';
        
        console.log(`\n📡 Sending to: ${callbackUrl}`);
        
        // Send the notification
        const response = await axios.post(callbackUrl, signedXML, {
            headers: {
                'Content-Type': 'application/xml',
                'User-Agent': 'ZE-DONE-ESS/1.0'
            },
            timeout: 30000
        });
        
        console.log('\n✅ SUCCESS!');
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${response.data || 'No response body'}`);
        
        return {
            success: true,
            status: response.status,
            data: response.data
        };

    } catch (error) {
        console.error('\n❌ ERROR sending notification:');
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
            return {
                success: false,
                status: error.response.status,
                error: error.response.data
            };
        } else if (error.code) {
            console.log('Error Code:', error.code);
            console.log('Message:', error.message);
        } else {
            console.log('Full Error:', error);
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Show the XML message only (without sending)
 */
function showXMLOnly() {
    console.log('📋 LOAN_DISBURSEMENT_FAILURE_NOTIFICATION XML Preview:');
    console.log('='.repeat(60) + '\n');
    
    const notificationData = createDisbursementFailureNotification();
    
    // Show JSON format first
    console.log('📄 Message Data (JSON):');
    console.log(JSON.stringify(notificationData, null, 2));
    
    // Show XML format
    console.log('\n📄 Signed XML Message:');
    console.log('='.repeat(70));
    const signedXML = digitalSignature.createSignedXML(notificationData);
    console.log(signedXML);
    console.log('='.repeat(70));
    
    console.log('\n📋 Usage:');
    console.log('To send this notification, run:');
    console.log('node send-disbursement-failure.js send');
}

// Main execution
const command = process.argv[2];

if (command === 'send') {
    sendDisbursementFailureNotification()
        .then(result => {
            if (result.success) {
                console.log('\n🎉 Notification sent successfully!');
                process.exit(0);
            } else {
                console.log('\n💥 Failed to send notification.');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
} else if (command === 'xml' || !command) {
    showXMLOnly();
} else {
    console.log('Usage:');
    console.log('  node send-disbursement-failure.js xml    - Show XML only');
    console.log('  node send-disbursement-failure.js send   - Send the notification');
}