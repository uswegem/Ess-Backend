// Debug loan records API
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ess';

async function debugAPI() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected');

    // Test 1: Count
    const total = await LoanMapping.countDocuments();
    console.log(`\n📊 Total loans: ${total}`);

    // Test 2: Find with select (like API does)
    const loans = await LoanMapping.find({})
      .select({
        essApplicationNumber: 1,
        essLoanNumberAlias: 1,
        essCheckNumber: 1,
        status: 1,
        loanAmount: 1,
        loanPurpose: 1
      })
      .limit(2)
      .lean();
    
    console.log(`\n📋 Loans with select: ${loans.length}`);
    console.log(JSON.stringify(loans, null, 2));

    // Test 3: Find without select
    const loansAll = await LoanMapping.find({}).limit(2).lean();
    console.log(`\n📋 Loans without select: ${loansAll.length}`);
    console.log(JSON.stringify(loansAll, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugAPI();
