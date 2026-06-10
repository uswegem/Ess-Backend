require('dotenv').config();
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');

async function checkLoanStatus() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore');
        
        const mapping = await LoanMapping.findOne({ essApplicationNumber: 'ESS1765974145523' });
        
        if (!mapping) {
            console.log('❌ Loan mapping not found');
            process.exit(1);
        }

        console.log('📊 Loan Mapping Status for ESS1765974145523');
        console.log('================================================');
        console.log('');
        console.log('Application Number:', mapping.essApplicationNumber);
        console.log('Loan Number:', mapping.essLoanNumberAlias);
        console.log('FSP Reference:', mapping.fspReferenceNumber);
        console.log('Status:', mapping.status);
        console.log('');
        console.log('CBS Integration:');
        console.log('  Client ID:', mapping.mifosClientId || '❌ Not created');
        console.log('  Loan ID:', mapping.mifosLoanId || '❌ Not created');
        console.log('');
        console.log('Amounts:');
        console.log('  Requested:', mapping.requestedAmount);
        console.log('  Disbursed:', mapping.disbursedAmount || 'Not disbursed');
        console.log('');
        console.log('Dates:');
        console.log('  Created:', mapping.createdAt);
        console.log('  Updated:', mapping.updatedAt);
        console.log('  Disbursed:', mapping.disbursedAt || 'Not disbursed');
        console.log('');
        
        if (mapping.mifosClientId && mapping.mifosLoanId) {
            console.log('✅ COMPLETE: CBS client and loan created successfully!');
        } else if (mapping.mifosClientId) {
            console.log('⚠️  PARTIAL: CBS client created, but loan creation pending');
        } else {
            console.log('⏳ PENDING: CBS integration not completed yet');
        }
        console.log('');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

checkLoanStatus();
