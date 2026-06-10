require('dotenv').config();
const { sendCallback } = require('./src/utils/callbackUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const logger = require('./src/utils/logger');
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');

async function sendDisbursementFailure() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore');
        console.log('✅ Connected to database');
        
        console.log('📤 Sending LOAN_DISBURSEMENT_FAILURE_NOTIFICATION');
        console.log('================================================');
        console.log('');
        console.log('Application Number: ESS1765974145523');
        console.log('Loan Number: LOAN1765963593440577');
        console.log('FSP Reference: 11915366');
        console.log('');

        const callbackData = {
            Header: {
                Sender: process.env.FSP_NAME || "ZE DONE",
                Receiver: "ESS_UTUMISHI",
                FSPCode: process.env.FSP_CODE || "FL8090",
                MsgId: getMessageId("LOAN_DISBURSEMENT_FAILURE_NOTIFICATION"),
                MessageType: "LOAN_DISBURSEMENT_FAILURE_NOTIFICATION"
            },
            MessageDetails: {
                ApplicationNumber: "ESS1765974145523",
                Reason: "CBS integration pending - Client and loan creation in progress"
            }
        };

        console.log('📋 Callback payload:');
        console.log(JSON.stringify(callbackData, null, 2));
        console.log('');

        console.log('🔄 Sending callback to utumishi...');
        const response = await sendCallback(callbackData);

        if (response && response.status === 200) {
            console.log('✅ Callback sent successfully!');
            console.log('Response Code:', response.data?.ResponseCode || 'N/A');
            console.log('Description:', response.data?.Description || 'N/A');
            
            // Update loan mapping status
            console.log('');
            console.log('📝 Updating loan mapping status...');
            const mapping = await LoanMapping.findOne({ essApplicationNumber: 'ESS1765974145523' });
            
            if (mapping) {
                mapping.status = 'DISBURSEMENT_FAILURE_NOTIFICATION_SENT';
                mapping.disbursementFailureNotificationSentAt = new Date();
                mapping.metadata = {
                    ...mapping.metadata,
                    disbursementFailureNotification: {
                        sentAt: new Date().toISOString(),
                        reason: callbackData.MessageDetails.Reason,
                        responseCode: response.data?.ResponseCode,
                        description: response.data?.Description
                    }
                };
                await mapping.save();
                console.log('✅ Loan mapping updated with DISBURSEMENT_FAILURE_NOTIFICATION_SENT status');
            } else {
                console.log('⚠️  Loan mapping not found');
            }
        } else {
            console.log('⚠️  Callback sent but received non-200 status');
            console.log('Status:', response?.status);
            console.log('Response:', JSON.stringify(response?.data, null, 2));
        }

        console.log('');
        console.log('✅ Done!');
        
    } catch (error) {
        console.error('❌ Error sending callback:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('🔌 Database connection closed');
        }
    }
}

sendDisbursementFailure();
