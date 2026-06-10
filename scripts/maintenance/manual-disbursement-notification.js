const axios = require('axios');
const digitalSignature = require('./src/utils/signatureUtils');
require('dotenv').config();

// Loan details from the LOAN_FINAL_APPROVAL_NOTIFICATION we received
const loanDetails = {
    applicationNumber: "ESS1763982075940",
    loanNumber: "LOAN1763993570520861", 
    fspReferenceNumber: "110977381",
    disbursementAmount: "4800000", // 4.8M as logged
    reason: "Loan application with application number ESS1763982075940 uploaded successfully at 2025-11-26T11:42:21.159"
};

/**
 * Create LOAN_DISBURSEMENT_NOTIFICATION message
 */
function createDisbursementNotification() {
    const messageData = {
        Header: {
            "Sender": process.env.FSP_NAME || "ZE DONE",
            "Receiver": "ESS_UTUMISHI", 
            "FSPCode": process.env.FSP_CODE || "FL8090",
            "MsgId": `DISB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "MessageType": "LOAN_DISBURSEMENT_NOTIFICATION"
        },
        MessageDetails: {
            "ApplicationNumber": loanDetails.applicationNumber,
            "Reason": loanDetails.reason,
            "FSPReferenceNumber": loanDetails.fspReferenceNumber,
            "LoanNumber": loanDetails.loanNumber,
            "TotalAmountToPay": loanDetails.disbursementAmount,
            "DisbursementDate": new Date().toISOString().replace('Z', ''),
        }
    };

    return messageData;
}

/**
 * Send the disbursement notification
 */
async function sendDisbursementNotification() {
    try {
        console.log('📤 Creating LOAN_DISBURSEMENT_NOTIFICATION...\n');
        
        // Create the notification data
        const notificationData = createDisbursementNotification();
        
        console.log('📋 Notification Details:');
        console.log('========================');
        console.log(`Application Number: ${notificationData.MessageDetails.ApplicationNumber}`);
        console.log(`Reason: ${notificationData.MessageDetails.Reason}`);
        console.log(`FSP Reference: ${notificationData.MessageDetails.FSPReferenceNumber}`);
        console.log(`Loan Number: ${notificationData.MessageDetails.LoanNumber}`);
        console.log(`Total Amount To Pay: ${notificationData.MessageDetails.TotalAmountToPay}`);
        console.log(`Disbursement Date: ${notificationData.MessageDetails.DisbursementDate}\n`);
        
        // Create signed XML
        console.log('🔐 Creating signed XML...');
        const signedXML = digitalSignature.createSignedXML(notificationData);
        
        console.log('📄 Generated XML Message:');
        console.log('='.repeat(60));
        console.log(signedXML);
        console.log('='.repeat(60));
        
        // Get callback URL from environment (same as used in callbackUtils.js)
        const callbackUrl = process.env.THIRD_PARTY_BASE_URL || process.env.ESS_CALLBACK_URL || 'http://localhost:3000/api/callback';
        
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
        console.error('\n❌ ERROR!');
        console.error(`Message: ${error.message}`);
        
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Response: ${error.response.data}`);
        } else if (error.code) {
            console.error(`Error Code: ${error.code}`);
        }
        
        return {
            success: false,
            error: error.message,
            details: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        };
    }
}

/**
 * Show the message only (without sending)
 */
function showMessage() {
    console.log('📋 LOAN_DISBURSEMENT_NOTIFICATION Message:');
    console.log('==========================================\n');
    
    const notificationData = createDisbursementNotification();
    
    // Show JSON format
    console.log('📄 Message Data (JSON):');
    console.log(JSON.stringify(notificationData, null, 2));
    
    // Show XML format
    console.log('\n📄 Signed XML Message:');
    console.log('='.repeat(60));
    const signedXML = digitalSignature.createSignedXML(notificationData);
    console.log(signedXML);
    console.log('='.repeat(60));
    
    console.log('\n📋 Usage:');
    console.log('To send this notification, run:');
    console.log('node manual-disbursement-notification.js send');
}

// Main execution
const command = process.argv[2];

if (command === 'send') {
    sendDisbursementNotification()
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
} else {
    showMessage();
}