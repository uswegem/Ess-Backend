// Quick MongoDB script to create loan mapping
require('dotenv').config();
const mongoose = require('mongoose');

async function quickCreate() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore');
    
    const LoanMapping = mongoose.model('LoanMapping', new mongoose.Schema({
        essApplicationNumber: String,
        essCheckNumber: String,
        fspReferenceNumber: String,
        essLoanNumberAlias: String,
        productCode: String,
        requestedAmount: Number,
        tenure: Number,
        status: String,
        metadata: Object,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }));

    console.log('Creating loan mapping...');
    const mapping = await LoanMapping.create({
        essApplicationNumber: 'ESS1765974145523',
        essCheckNumber: '11915366',
        fspReferenceNumber: '11915366',
        essLoanNumberAlias: 'LOAN1765963593440577',
        productCode: '17',
        requestedAmount: 5000000,
        tenure: 60,
        status: 'FINAL_APPROVAL_RECEIVED',
        metadata: {
            createdVia: 'quick_script',
            note: 'Created for LOAN_FINAL_APPROVAL without prior offer'
        }
    });

    console.log('✅ Loan mapping created:', mapping._id);
    console.log(JSON.stringify(mapping, null, 2));
    
    await mongoose.connection.close();
    process.exit(0);
}

quickCreate().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
