require('dotenv').config();
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');
const MessageLog = require('./src/models/MessageLog');

async function checkLoan() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 Checking loan status for ESS1766006882463\n');
        console.log('='.repeat(70));

        // Check loan mapping
        console.log('\n📋 1. LOAN MAPPING CHECK:');
        const mapping = await LoanMapping.findOne({ essApplicationNumber: 'ESS1766006882463' });
        if (mapping) {
            console.log('✅ Loan Mapping Found:');
            console.log('   Application Number:', mapping.essApplicationNumber);
            console.log('   FSP Loan Number:', mapping.fspLoanNumber);
            console.log('   ESS Loan Number:', mapping.essLoanNumber);
            console.log('   MIFOS Client ID:', mapping.mifosClientId);
            console.log('   MIFOS Loan ID:', mapping.mifosLoanId);
            console.log('   Status:', mapping.status);
            console.log('   Created At:', mapping.createdAt);
            console.log('   Updated At:', mapping.updatedAt);
        } else {
            console.log('❌ No loan mapping found');
        }

        // Check message logs
        console.log('\n📨 2. MESSAGE LOGS CHECK:');
        const messages = await MessageLog.find({
            $or: [
                { 'messageData.MessageDetails.ApplicationNumber': 'ESS1766006882463' },
                { 'messageData.MessageDetails.LoanNumber': 'LOAN1765996440393783' },
                { 'messageData.MessageDetails.FSPReferenceNumber': '11915366' }
            ]
        }).sort({ createdAt: -1 }).limit(5);

        if (messages.length > 0) {
            console.log(`✅ Found ${messages.length} message(s):`);
            messages.forEach((msg, idx) => {
                console.log(`\n   Message ${idx + 1}:`);
                console.log('   Type:', msg.messageType);
                console.log('   Direction:', msg.direction);
                console.log('   Status:', msg.status);
                console.log('   Timestamp:', msg.createdAt);
                if (msg.errorMessage) {
                    console.log('   Error:', msg.errorMessage);
                }
            });
        } else {
            console.log('❌ No message logs found');
        }

        console.log('\n' + '='.repeat(70));
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkLoan();
