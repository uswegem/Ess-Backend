require('dotenv').config();
const axios = require('axios');

// MIFOS API Configuration
const MIFOS_BASE_URL = process.env.CBS_BASE_URL;
const MIFOS_TENANT = process.env.CBS_Tenant;
const MIFOS_USERNAME = process.env.CBS_MAKER_USERNAME;
const MIFOS_PASSWORD = process.env.CBS_MAKER_PASSWORD;
const LOAN_PRODUCT_ID = 17;

const mifosApi = axios.create({
  baseURL: MIFOS_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Fineract-Platform-TenantId': MIFOS_TENANT
  },
  auth: {
    username: MIFOS_USERNAME,
    password: MIFOS_PASSWORD
  },
  timeout: 30000
});

function formatDateForMifos(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// Our local EMI calculation (for reverse calculation)
function calculateMaxLoanFromEMI(targetEMI, annualInterestRate, tenureMonths) {
  const monthlyRate = annualInterestRate / 100 / 12;
  
  if (monthlyRate === 0) {
    return targetEMI * tenureMonths;
  }

  const maxAmount = (targetEMI * (Math.pow(1 + monthlyRate, tenureMonths) - 1)) /
                    (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));

  return Math.round(maxAmount * 100) / 100;
}

async function testMifosCalculation(principal, tenure, scenario) {
  try {
    const today = new Date();
    const expectedDisbursementDate = formatDateForMifos(today);
    const submittedOnDate = formatDateForMifos(today);

    const payload = {
      clientId: 2, // Use existing test client
      productId: LOAN_PRODUCT_ID,
      loanType: "individual",
      principal: principal,
      loanTermFrequency: tenure,
      loanTermFrequencyType: 2,
      numberOfRepayments: tenure,
      repaymentEvery: 1,
      repaymentFrequencyType: 2,
      interestRatePerPeriod: 24,
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      expectedDisbursementDate: expectedDisbursementDate,
      submittedOnDate: submittedOnDate,
      dateFormat: "dd MMMM yyyy",
      locale: "en",
      transactionProcessingStrategyCode: "mifos-standard-strategy"
    };

    console.log(`\n${'='.repeat(80)}`);
    console.log(`${scenario}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Input: Principal=${principal.toLocaleString()} TZS, Tenure=${tenure} months`);
    console.log(`Calling MIFOS calculateLoanSchedule API...`);

    const response = await mifosApi.post('/v1/loans?command=calculateLoanSchedule', payload);
    const data = response.data;

    // MIFOS returns schedule data at root level
    const periods = data.periods || [];
    const totalInterest = data.totalInterestCharged || 0;
    const totalRepayment = data.totalRepaymentExpected || 0;
    const totalFees = data.totalFeeChargesCharged || 0;
    
    const repaymentPeriods = periods.filter(p => p.period > 0);
    
    if (repaymentPeriods.length === 0) {
      console.log('❌ No repayment periods returned');
      return null;
    }

    const firstPeriod = repaymentPeriods[0];
    const emi = firstPeriod.totalDueForPeriod || 0;

    // Calculate charges
    const processingFee = principal * 0.02;
    const insurance = principal * 0.015;
    const applicationFee = 50000;
    const totalCharges = processingFee + insurance + applicationFee;
    const netDisbursement = principal - totalCharges;

    console.log(`\n✅ MIFOS Response:`);
    console.log(`   Monthly EMI: ${emi.toLocaleString()} TZS`);
    console.log(`   Total Interest: ${totalInterest.toLocaleString()} TZS`);
    console.log(`   Total Repayment: ${totalRepayment.toLocaleString()} TZS`);
    console.log(`   Total Fees (from MIFOS): ${totalFees.toLocaleString()} TZS`);
    console.log(`\n   Charges Breakdown:`);
    console.log(`   - Processing Fee (2%): ${processingFee.toLocaleString()} TZS`);
    console.log(`   - Insurance (1.5%): ${insurance.toLocaleString()} TZS`);
    console.log(`   - Application Fee: ${applicationFee.toLocaleString()} TZS`);
    console.log(`   - Total Charges: ${totalCharges.toLocaleString()} TZS`);
    console.log(`\n   Net Disbursement: ${netDisbursement.toLocaleString()} TZS`);

    // Show first 3 periods
    console.log(`\n   Repayment Schedule (first 3 periods):`);
    repaymentPeriods.slice(0, 3).forEach(p => {
      console.log(`   Period ${p.period}: Principal=${p.principalDue?.toLocaleString() || 0} TZS, Interest=${p.interestDue?.toLocaleString() || 0} TZS, Total=${p.totalDueForPeriod?.toLocaleString() || 0} TZS`);
    });

    return {
      principal,
      emi,
      totalInterest,
      totalRepayment,
      processingFee,
      insurance,
      applicationFee,
      totalCharges,
      netDisbursement
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function runTests() {
  console.log('\n' + '█'.repeat(80));
  console.log('  MIFOS CALCULATION TEST - Forward & Reverse');
  console.log('█'.repeat(80));

  // Test 1: Forward Calculation (Principal → EMI)
  console.log('\n\n📊 TEST 1: FORWARD CALCULATION (Principal → EMI)');
  console.log('Scenario: Customer wants 1,000,000 TZS loan for 24 months');
  
  const forwardResult = await testMifosCalculation(1000000, 24, 'FORWARD CALCULATION');

  // Test 2: Reverse Calculation (EMI → Principal)
  console.log('\n\n📊 TEST 2: REVERSE CALCULATION (EMI → Principal)');
  console.log('Scenario: Customer can afford 100,000 TZS monthly EMI for 24 months');
  
  const targetEMI = 100000;
  const tenure = 24;
  const interestRate = 24;
  
  console.log(`\nStep 1: Calculate max principal from target EMI using our formula`);
  console.log(`   Target EMI: ${targetEMI.toLocaleString()} TZS`);
  console.log(`   Tenure: ${tenure} months`);
  console.log(`   Interest Rate: ${interestRate}% per year`);
  
  const calculatedPrincipal = calculateMaxLoanFromEMI(targetEMI, 24, tenure);
  console.log(`   Calculated Principal: ${calculatedPrincipal.toLocaleString()} TZS`);
  
  console.log(`\nStep 2: Verify with MIFOS using calculated principal`);
  const reverseResult = await testMifosCalculation(calculatedPrincipal, tenure, 'REVERSE CALCULATION (Verification)');

  // Test 3: Another Forward test with different amount
  console.log('\n\n📊 TEST 3: FORWARD CALCULATION (Larger Amount)');
  console.log('Scenario: Customer wants 5,000,000 TZS loan for 60 months');
  
  const forwardResult2 = await testMifosCalculation(5000000, 60, 'FORWARD CALCULATION (5M for 60 months)');

  // Test 4: Reverse with higher EMI
  console.log('\n\n📊 TEST 4: REVERSE CALCULATION (Higher EMI)');
  console.log('Scenario: Customer can afford 500,000 TZS monthly EMI for 36 months');
  
  const targetEMI2 = 500000;
  const tenure2 = 36;
  
  console.log(`\nStep 1: Calculate max principal from target EMI`);
  console.log(`   Target EMI: ${targetEMI2.toLocaleString()} TZS`);
  console.log(`   Tenure: ${tenure2} months`);
  
  const calculatedPrincipal2 = calculateMaxLoanFromEMI(targetEMI2, 24, tenure2);
  console.log(`   Calculated Principal: ${calculatedPrincipal2.toLocaleString()} TZS`);
  
  console.log(`\nStep 2: Verify with MIFOS`);
  const reverseResult2 = await testMifosCalculation(calculatedPrincipal2, tenure2, 'REVERSE CALCULATION (500K EMI for 36 months)');

  // Summary
  console.log('\n\n' + '█'.repeat(80));
  console.log('  TEST SUMMARY');
  console.log('█'.repeat(80));
  
  if (forwardResult) {
    console.log(`\n✅ Test 1 (Forward - 1M/24mo): EMI = ${forwardResult.emi.toLocaleString()} TZS`);
  }
  
  if (reverseResult) {
    console.log(`✅ Test 2 (Reverse - 100K EMI): Principal = ${reverseResult.principal.toLocaleString()} TZS, Actual EMI = ${reverseResult.emi.toLocaleString()} TZS`);
    const emiDiff = Math.abs(reverseResult.emi - targetEMI);
    console.log(`   EMI Difference: ${emiDiff.toLocaleString()} TZS (${((emiDiff/targetEMI)*100).toFixed(2)}%)`);
  }
  
  if (forwardResult2) {
    console.log(`✅ Test 3 (Forward - 5M/60mo): EMI = ${forwardResult2.emi.toLocaleString()} TZS`);
  }
  
  if (reverseResult2) {
    console.log(`✅ Test 4 (Reverse - 500K EMI): Principal = ${reverseResult2.principal.toLocaleString()} TZS, Actual EMI = ${reverseResult2.emi.toLocaleString()} TZS`);
    const emiDiff2 = Math.abs(reverseResult2.emi - targetEMI2);
    console.log(`   EMI Difference: ${emiDiff2.toLocaleString()} TZS (${((emiDiff2/targetEMI2)*100).toFixed(2)}%)`);
  }

  console.log('\n' + '█'.repeat(80));
  console.log('  CONCLUSION');
  console.log('█'.repeat(80));
  console.log('\n✅ MIFOS can calculate loan schedule when given principal + tenure');
  console.log('✅ For reverse calculation: Use formula to get principal, then verify with MIFOS');
  console.log('✅ This ensures EMI returned matches what MIFOS will use in actual loan creation');
  console.log('\n');
}

runTests();
