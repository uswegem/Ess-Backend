require('dotenv').config();
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');
const MessageLog = require('./src/models/MessageLog');

async function checkRemoteLoan() {
    try {
        // Connect to remote MongoDB
        const remoteMongoUri = `mongodb://${process.env.REMOTE_SERVER}:27017/miracore`;
        console.log(`🔗 Connecting to remote MongoDB: ${remoteMongoUri}\n`);
        
        await mongoose.connect(remoteMongoUri, {
            serverSelectionTimeoutMS: 5000
        });
        
        console.log('✅ Connected to remote MongoDB\n');
        console.log('='.repeat(70));

        // Check loan mapping
        console.log('\n📋 1. LOAN MAPPING CHECK (Remote Server):');
        const mapping = await LoanMapping.findOne({ essApplicationNumber: 'ESS1766006882463' });
        if (mapping) {
            console.log('✅ Loan Mapping Found:');
            console.log(JSON.stringify(mapping, null, 2));
        } else {
            console.log('❌ No loan mapping found');
        }

        // Check message logs
        console.log('\n📨 2. MESSAGE LOGS CHECK (Remote Server):');
        const messages = await MessageLog.find({
            $or: [
                { 'messageData.MessageDetails.ApplicationNumber': 'ESS1766006882463' },
                { 'messageData.MessageDetails.LoanNumber': 'LOAN1765996440393783' },
                { 'messageData.MessageDetails.FSPReferenceNumber': '11915366' }
            ]
        }).sort({ createdAt: -1 }).limit(10);

        if (messages.length > 0) {
            console.log(`✅ Found ${messages.length} message(s):\n`);
            messages.forEach((msg, idx) => {
                console.log(`Message ${idx + 1}:`);
                console.log('  Type:', msg.messageType);
                console.log('  Direction:', msg.direction);
                console.log('  Status:', msg.status);
                console.log('  Timestamp:', msg.createdAt);
                if (msg.errorMessage) {
                    console.log('  ❌ Error:', msg.errorMessage);
                }
                console.log('');
            });
        } else {
            console.log('❌ No message logs found');
        }

        // Check recent LOAN_FINAL_APPROVAL_NOTIFICATION messages
        console.log('\n📨 3. RECENT FINAL APPROVAL MESSAGES:');
        const recentApprovals = await MessageLog.find({
            messageType: 'LOAN_FINAL_APPROVAL_NOTIFICATION'
        }).sort({ createdAt: -1 }).limit(5);

        if (recentApprovals.length > 0) {
            console.log(`✅ Found ${recentApprovals.length} recent approval(s):\n`);
            recentApprovals.forEach((msg, idx) => {
                const appNum = msg.messageData?.MessageDetails?.ApplicationNumber;
                console.log(`${idx + 1}. App: ${appNum || 'N/A'} | Status: ${msg.status} | ${msg.createdAt}`);
            });
        }

        console.log('\n' + '='.repeat(70));
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.name === 'MongooseServerSelectionError') {
            console.error('\n⚠️  Cannot connect to remote MongoDB. Server may not allow external connections.');
        }
        process.exit(1);
    }
}

checkRemoteLoan();
