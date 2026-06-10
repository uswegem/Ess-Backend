const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const LoanMapping = require('./src/models/LoanMapping');

async function checkLoanMapping() {
    try {
        console.log('🔍 Checking loan mappings in database...\n');
        
        // Find the most recent loan mapping
        const recentMappings = await LoanMapping.find()
            .sort({ createdAt: -1 })
            .limit(5);
        
        console.log(`📊 Found ${recentMappings.length} recent loan mappings:\n`);
        
        recentMappings.forEach((mapping, index) => {
            console.log(`${index + 1}. Application: ${mapping.essApplicationNumber}`);
            console.log(`   Check Number: ${mapping.essCheckNumber}`);
            console.log(`   Status: ${mapping.status}`);
            console.log(`   Client ID: ${mapping.mifosClientId || 'Not yet created'}`);
            
            if (mapping.metadata && mapping.metadata.clientData) {
                console.log(`   Client Name: ${mapping.metadata.clientData.fullName}`);
                console.log(`   Mobile: ${mapping.metadata.clientData.mobileNumber}`);
            }
            
            if (mapping.metadata && mapping.metadata.clientId) {
                console.log(`   ✅ CBS Client ID: ${mapping.metadata.clientId}`);
            }
            
            console.log(`   Created: ${mapping.createdAt}`);
            console.log(`   Updated: ${mapping.updatedAt}`);
            console.log('');
        });
        
        // Find specific application if provided
        if (process.argv[2]) {
            const appNumber = process.argv[2];
            console.log(`\n🔍 Searching for specific application: ${appNumber}\n`);
            
            const specific = await LoanMapping.findOne({ essApplicationNumber: appNumber });
            
            if (specific) {
                console.log('📋 Full Details:');
                console.log(JSON.stringify(specific.toObject(), null, 2));
            } else {
                console.log('❌ Application not found');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

checkLoanMapping();
