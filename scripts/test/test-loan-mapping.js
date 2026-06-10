const LOAN_CONSTANTS = require('./src/utils/loanConstants');
const connectDB = require('./src/config/database');

async function testLoanMapping() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Test 1: Create initial mapping
    console.log('\n📝 Test 1: Creating initial loan mapping...');
    const timestamp = Date.now();
    const mapping = await LoanMappingService.createInitialMapping(
      `APP${timestamp}`,
      `CHK${timestamp}`,
      `FSPREF${timestamp}`,
      {
        productCode: '17',
        requestedAmount: LOAN_CONSTANTS.TEST_LOAN_AMOUNT,
        tenure: LOAN_CONSTANTS.TEST_TENURE
      }
    );
    console.log('✅ Initial mapping created:', mapping._id);

    // Test 2: Update with final approval
    console.log('\n📝 Test 2: Updating with final approval...');
    const loanAlias = LoanMappingService.generateLoanNumberAlias();
    const updatedMapping = await LoanMappingService.updateWithFinalApproval(loanAlias, {
      applicationNumber: `APP${timestamp}`,
      loanNumber: loanAlias,
      requestedAmount: LOAN_CONSTANTS.TEST_LOAN_AMOUNT,
      productCode: '17',
      tenure: LOAN_CONSTANTS.TEST_TENURE
    });
    console.log('✅ Mapping updated with final approval');

    // Test 3: Update with client creation
    console.log('\n📝 Test 3: Updating with client creation...');
    await LoanMappingService.updateWithClientCreation(loanAlias, LOAN_CONSTANTS.TEST_CLIENT_ID);
    console.log('✅ Mapping updated with client creation');

    // Test 4: Update with loan creation
    console.log('\n📝 Test 4: Updating with loan creation...');
    await LoanMappingService.updateWithLoanCreation(loanAlias, LOAN_CONSTANTS.TEST_LOAN_ID, LOAN_CONSTANTS.TEST_LOAN_ALIAS);
    console.log('✅ Mapping updated with loan creation');

    // Test 5: Retrieve mapping
    console.log('\n📝 Test 5: Retrieving mapping by ESS loan alias...');
    const retrievedMapping = await LoanMappingService.getByEssLoanNumberAlias(loanAlias);
    console.log('✅ Retrieved mapping:', {
      essApplicationNumber: retrievedMapping.essApplicationNumber,
      essCheckNumber: retrievedMapping.essCheckNumber,
      essLoanNumberAlias: retrievedMapping.essLoanNumberAlias,
      mifosClientId: retrievedMapping.mifosClientId,
      mifosLoanId: retrievedMapping.mifosLoanId,
      status: retrievedMapping.status
    });

    // Test 6: Update with disbursement
    console.log('\n📝 Test 6: Updating with disbursement...');
    await LoanMappingService.updateWithDisbursement(LOAN_CONSTANTS.TEST_LOAN_ID);
    console.log('✅ Mapping updated with disbursement');

    // Test 7: Get stats
    console.log('\n📝 Test 7: Getting mapping stats...');
    const stats = await LoanMappingService.getStats();
    console.log('✅ Mapping stats:', stats);

    console.log('\n🎉 All loan mapping tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testLoanMapping();