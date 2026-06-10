require('dotenv').config();
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');

async function checkMapping() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🔍 Searching for loan mapping...\n');
        
        // Search by multiple criteria
        const mapping = await LoanMapping.findOne({ 
            $or: [
                { essApplicationNumber: 'ESS1766006882463' }, 
                { essCheckNumber: '11915366' }, 
                { 'metadata.clientData.nin': '19711126114060000121' }
            ] 
        });
        
        if (mapping) {
            console.log('✅ MAPPING FOUND:');
            console.log(JSON.stringify(mapping, null, 2));
        } else {
            console.log('❌ NO MAPPING FOUND');
            console.log('\n🔍 Checking all recent mappings...');
            const recentMappings = await LoanMapping.find({}).sort({ createdAt: -1 }).limit(10);
            console.log(`Found ${recentMappings.length} recent mappings:`);
            recentMappings.forEach((m, idx) => {
                console.log(`${idx + 1}. ${m.essApplicationNumber || 'N/A'} - ${m.status} - ${m.createdAt}`);
            });
        }
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkMapping();
