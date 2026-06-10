require('dotenv').config();
const mongoose = require('mongoose');

async function checkClient() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore');
        console.log('Connected to MongoDB');

        // Get the most recent loan mapping
        const LoanMapping = require('./src/models/LoanMapping');
        const mapping = await LoanMapping.find().sort({ createdAt: -1 }).limit(5);
        
        console.log('\nRecent loan mappings:', JSON.stringify(mapping, null, 2));
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkClient();