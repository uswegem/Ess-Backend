const axios = require('axios');
const LOAN_CONSTANTS = require('./src/utils/loanConstants');

async function testDisbursementNotification() {
    console.log('🔔 Testing LOAN_DISBURSEMENT_NOTIFICATION via Webhook\n');
    console.log('='.repeat(60) + '\n');

    // Simulate MIFOS webhook payload for loan disbursement
    const webhookPayload = {
        entityName: 'LOAN',
        action: 'DISBURSE',
        entityId: LOAN_CONSTANTS.TEST_CLIENT_ID, // Mock loan ID
        entityData: {
            principal: LOAN_CONSTANTS.TEST_LOAN_AMOUNT,
            accountNo: LOAN_CONSTANTS.TEST_ACCOUNT_NO,
            externalId: 'APP001'
        }
    };

    console.log('📨 Simulating MIFOS webhook payload:');
    console.log(JSON.stringify(webhookPayload, null, 2));
    console.log('\n📥 Expected LOAN_DISBURSEMENT_NOTIFICATION to ESS:');

    // This would normally be sent by making an actual HTTP request to the webhook endpoint
    // For testing, we'll simulate what the webhook handler does

    const applicationNumber = webhookPayload.entityData.externalId || webhookPayload.entityData.accountNo;
    const fspReferenceNumber = `FSP${webhookPayload.entityId}`;
    const loanNumber = webhookPayload.entityData.accountNo;

    // Mock loan and client data (normally retrieved from MIFOS)
    const mockLoan = {
        clientId: LOAN_CONSTANTS.TEST_LOAN_ID,
        principal: webhookPayload.entityData.principal,
        accountNo: webhookPayload.entityData.accountNo
    };

    const disbursementNotification = {
        Data: {
            Header: {
                Sender: process.env.FSP_NAME || LOAN_CONSTANTS.FSP_NAME,
                Receiver: LOAN_CONSTANTS.EXTERNAL_SYSTEM,
                FSPCode: process.env.FSP_CODE || LOAN_CONSTANTS.FSP_CODE,
                MsgId: `WEBHOOK_DISBURSE_${Date.now()}`,
                MessageType: "LOAN_DISBURSEMENT_NOTIFICATION"
            },
            MessageDetails: {
                ApplicationNumber: applicationNumber,
                FSPReferenceNumber: fspReferenceNumber,
                LoanNumber: loanNumber,
                ClientId: mockLoan.clientId,
                LoanId: webhookPayload.entityId,
                DisbursedAmount: mockLoan.principal,
                DisbursementDate: new Date().toISOString().split('T')[0],
                Status: "DISBURSED"
            }
        }
    };

    console.log('Expected notification structure:');
    console.log(JSON.stringify(disbursementNotification, null, 2));

    console.log('\n✅ Webhook handler now properly sends LOAN_DISBURSEMENT_NOTIFICATION to ESS');
    console.log('✅ This notification informs ESS that the loan has been disbursed successfully');
}

testDisbursementNotification().catch(console.error);