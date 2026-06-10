const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

(async () => {
  try {
    const loanId = 31;
    console.log('Fetching loan details for ID:', loanId);

    const response = await api.get(`/v1/loans/${loanId}?associations=repaymentSchedule`);
    const loan = response.data;

    console.log('\n=== LOAN DETAILS ===');
    console.log('Loan ID:', loan.id);
    console.log('Account No:', loan.accountNo);
    console.log('External ID:', loan.externalId);
    console.log('Status:', loan.status?.value);
    console.log('\n=== FINANCIAL SUMMARY ===');
    console.log('Principal:', loan.principal);
    console.log('Principal Disbursed:', loan.summary?.principalDisbursed);
    console.log('Principal Outstanding:', loan.summary?.principalOutstanding);
    console.log('Total Outstanding:', loan.summary?.totalOutstanding);
    console.log('Interest Outstanding:', loan.summary?.interestOutstanding);
    console.log('\n=== LOAN TERMS ===');
    console.log('Interest Rate:', loan.interestRatePerPeriod, '%');
    console.log('Number of Repayments:', loan.numberOfRepayments);

    if (loan.repaymentSchedule?.periods) {
      const unpaidPeriods = loan.repaymentSchedule.periods.filter(p => p.period && !p.complete && p.dueDate);
      console.log('\n=== REPAYMENT SCHEDULE ===');
      console.log('Total Periods:', loan.repaymentSchedule.periods.length - 1);
      console.log('Unpaid Periods:', unpaidPeriods.length);

      if (unpaidPeriods.length > 0) {
        const nextPeriod = unpaidPeriods[0];
        console.log('\n=== NEXT UNPAID PERIOD ===');
        console.log('Period:', nextPeriod.period);
        console.log('Due Date:', nextPeriod.dueDate);
        console.log('Principal Due:', nextPeriod.principalDue || nextPeriod.principalOriginalDue);
        console.log('Interest Due:', nextPeriod.interestDue || nextPeriod.interestOriginalDue);
        console.log('Total Due:', nextPeriod.totalDueForPeriod);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
})();