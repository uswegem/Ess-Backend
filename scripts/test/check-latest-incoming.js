require('dotenv').config();
const mongoose = require('mongoose');

async function checkLatestIncoming() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore');
        console.log('Connected to MongoDB');

        // Get the most recent incoming message
        const MessageLog = require('./src/models/MessageLog');
        const message = await MessageLog.find({ direction: 'incoming' }).sort({ createdAt: -1 }).limit(1);

        if (message.length > 0) {
            console.log('\nLatest incoming message:');
            console.log(JSON.stringify(message[0], null, 2));
        } else {
            console.log('No incoming messages found.');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkLatestIncoming();