const MifosLoanRestructureService = require('./src/services/mifosLoanRestructureService');
const logger = require('./src/utils/logger');

/**
 * Example usage of MIFOS Loan Restructuring APIs
 */
async function demonstrateLoanRestructuring() {
  console.log('🚀 Demonstrating MIFOS Loan Restructuring APIs\n');

  try {
    // Example loan ID (replace with actual loan ID)
    const loanId = 123;

    // Step 1: Get available reschedule reasons
    console.log('📋 STEP 1: Getting available reschedule reasons...');
    const rescheduleReasons = await MifosLoanRestructureService.getRescheduleReasons();
    console.log('✅ Available reasons:', rescheduleReasons.map(r => ({ id: r.id, name: r.name })));

    // Step 2: Create a reschedule request
    console.log('\n📋 STEP 2: Creating reschedule request...');
    const rescheduleData = {
      loanId: loanId,
      rescheduleFromDate: '15 January 2024',  // Date from which to reschedule
      rescheduleReasonId: 1,  // Use appropriate reason ID
      rescheduleReasonComment: 'Customer experiencing temporary financial hardship due to medical expenses',
      submittedOnDate: '10 January 2024',
      extraTerms: 6,  // Add 6 additional months
      newInterestRate: 12.5,  // Reduce interest rate to 12.5%
      graceOnPrincipal: 2,  // 2 months grace on principal
      graceOnInterest: 1   // 1 month grace on interest
    };

    const rescheduleResult = await MifosLoanRestructureService.createRescheduleRequest(rescheduleData);
    console.log('✅ Reschedule request created:', {
      rescheduleId: rescheduleResult.resourceId,
      loanId: loanId
    });

    const rescheduleId = rescheduleResult.resourceId;

    // Step 3: Get reschedule details
    console.log('\n📋 STEP 3: Getting reschedule request details...');
    const rescheduleDetails = await MifosLoanRestructureService.getRescheduleDetails(rescheduleId);
    console.log('✅ Reschedule details:', {
      id: rescheduleDetails.id,
      loanId: rescheduleDetails.loanId,
      status: rescheduleDetails.statusEnum?.value,
      rescheduleFromDate: rescheduleDetails.rescheduleFromDate,
      extraTerms: rescheduleDetails.extraTerms,
      newInterestRate: rescheduleDetails.interestRate
    });

    // Step 4: Approve the reschedule (for demonstration)
    console.log('\n📋 STEP 4: Approving reschedule request...');
    const approvalResult = await MifosLoanRestructureService.approveReschedule(
      rescheduleId,
      '12 January 2024',  // Approval date
      'Approved after reviewing customer financial situation'
    );
    console.log('✅ Reschedule approved:', approvalResult);

    // Step 5: Alternative - Complete restructuring workflow
    console.log('\n📋 STEP 5: Demonstrating complete restructuring workflow...');
    const anotherLoanId = 456;  // Another loan ID for demonstration
    
    const restructureParams = {
      rescheduleFromDate: '20 January 2024',
      submittedOnDate: '15 January 2024',
      approvalDate: '18 January 2024',
      rescheduleReasonId: 2,
      reason: 'Customer requested extended payment terms due to business seasonality',
      extraTerms: 12,  // Extend by 12 months
      newInterestRate: 14.0,  // New interest rate
      graceOnPrincipal: 3,  // 3 months principal grace
      autoApprove: true  // Auto-approve for demo
    };

    const restructureResult = await MifosLoanRestructureService.restructureLoan(
      anotherLoanId, 
      restructureParams
    );
    console.log('✅ Complete restructuring result:', restructureResult);

    console.log('\n📊 LOAN RESTRUCTURING DEMO SUMMARY');
    console.log('=====================================');
    console.log('✅ Reschedule reasons fetched successfully');
    console.log('✅ Reschedule request created successfully');
    console.log('✅ Reschedule request approved successfully');
    console.log('✅ Complete restructuring workflow demonstrated');

    return {
      success: true,
      message: 'All loan restructuring operations completed successfully',
      operations: [
        'Fetch reschedule reasons',
        'Create reschedule request',
        'Approve reschedule',
        'Complete restructuring workflow'
      ]
    };

  } catch (error) {
    console.error('❌ Loan restructuring demo failed:', error.message);
    
    // Common troubleshooting steps
    console.log('\n💡 Troubleshooting Tips:');
    console.log('1. Ensure loan ID exists and is in active status');
    console.log('2. Check that reschedule reason ID is valid');
    console.log('3. Verify date format: "dd MMMM yyyy" (e.g., "15 January 2024")');
    console.log('4. Ensure user has permission for loan reschedule operations');
    console.log('5. Check CBS connectivity and authentication');

    return {
      success: false,
      error: error.message,
      recommendations: [
        'Verify loan exists and is disbursed',
        'Check reschedule reason IDs',
        'Validate date formats',
        'Confirm user permissions',
        'Test CBS connectivity'
      ]
    };
  }
}

// Export for use in other modules
module.exports = { demonstrateLoanRestructuring };

// Run demo if called directly
if (require.main === module) {
  require('dotenv').config();
  
  demonstrateLoanRestructuring()
    .then(result => {
      console.log('\n🎯 Demo completed:', result.success ? 'SUCCESS' : 'FAILED');
      if (!result.success && result.recommendations) {
        console.log('\n💡 Recommendations:');
        result.recommendations.forEach(rec => console.log(`  - ${rec}`));
      }
    })
    .catch(error => {
      console.error('\n💥 Demo execution failed:', error.message);
    });
}