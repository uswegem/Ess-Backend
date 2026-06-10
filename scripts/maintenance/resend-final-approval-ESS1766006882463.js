const axios = require('axios');
require('dotenv').config();

const API_URL = `http://${process.env.REMOTE_SERVER}:${process.env.PORT}/api/loan`;

// Resend LOAN_FINAL_APPROVAL_NOTIFICATION for ESS1766006882463
async function resendFinalApprovalNotification() {
    const applicationNumber = 'ESS1766006882463';
    
    console.log('🚀 Resending LOAN_FINAL_APPROVAL_NOTIFICATION');
    console.log('='.repeat(70));
    console.log(`📋 Application Number: ${applicationNumber}\n`);

    // Standard LOAN_FINAL_APPROVAL_NOTIFICATION structure (5 fields only)
    const finalApprovalRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>RESEND_STD_${Date.now()}</MsgId>
            <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>${applicationNumber}</ApplicationNumber>
            <Reason>Loan application with application number ${applicationNumber} uploaded successfully at 2025-12-17T21:41:53.493</Reason>
            <LoanNumber>LOAN1765996440393783</LoanNumber>
            <FSPReferenceNumber>11915366</FSPReferenceNumber>
            <Approval>APPROVED</Approval>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(finalApprovalRequest);
    console.log('\n📥 RESPONSE:\n');

    try {
        const response = await axios.post(API_URL, finalApprovalRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 30000
        });
        
        console.log('✅ SUCCESS!');
        console.log('Status:', response.status);
        console.log('Response Data:');
        console.log(response.data);
        
    } catch (error) {
        console.log('❌ ERROR:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response Data:', error.response.data);
        } else if (error.code) {
            console.log('Error Code:', error.code);
        }
    }
}

// Run the function
resendFinalApprovalNotification().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
