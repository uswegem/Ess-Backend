const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

async function setupReports() {
  try {
    console.log('=== SETTING UP FINANCIAL REPORTS ===\n');
    
    // 1. Check existing reports
    console.log('Fetching existing reports...\n');
    const reportsResponse = await api.get('/v1/reports');
    const reports = reportsResponse.data;
    
    console.log(`Total Reports: ${reports.length}\n`);
    
    // Filter for financial reports
    const loanReports = reports.filter(r => r.reportCategory?.toLowerCase().includes('loan'));
    const accountingReports = reports.filter(r => 
      r.reportCategory?.toLowerCase().includes('accounting') || 
      r.reportName?.toLowerCase().includes('trial balance') ||
      r.reportName?.toLowerCase().includes('balance sheet') ||
      r.reportName?.toLowerCase().includes('income statement')
    );
    
    console.log('--- LOAN REPORTS ---');
    if (loanReports.length > 0) {
      loanReports.forEach(r => {
        console.log(`  ✅ ${r.reportName} (${r.reportType})`);
        console.log(`     Category: ${r.reportCategory}`);
        console.log(`     SQL: ${r.reportSql ? 'Yes' : 'No'}`);
        console.log('');
      });
    } else {
      console.log('  No loan reports found\n');
    }
    
    console.log('--- ACCOUNTING REPORTS ---');
    if (accountingReports.length > 0) {
      accountingReports.forEach(r => {
        console.log(`  ✅ ${r.reportName} (${r.reportType})`);
        console.log(`     Category: ${r.reportCategory}`);
        console.log('');
      });
    } else {
      console.log('  No accounting reports found\n');
    }
    
    // 2. Check for Trial Balance
    console.log('--- CHECKING CORE FINANCIAL REPORTS ---\n');
    
    const trialBalance = reports.find(r => 
      r.reportName?.toLowerCase().includes('trial balance')
    );
    
    const incomeStatement = reports.find(r => 
      r.reportName?.toLowerCase().includes('income') && 
      r.reportName?.toLowerCase().includes('statement')
    );
    
    const balanceSheet = reports.find(r => 
      r.reportName?.toLowerCase().includes('balance') && 
      r.reportName?.toLowerCase().includes('sheet')
    );
    
    console.log('Trial Balance:', trialBalance ? '✅ Available' : '❌ Not Found');
    console.log('Income Statement:', incomeStatement ? '✅ Available' : '❌ Not Found');
    console.log('Balance Sheet:', balanceSheet ? '✅ Available' : '❌ Not Found');
    
    // 3. Show how to generate reports
    console.log('\n--- HOW TO GENERATE REPORTS ---\n');
    
    console.log('1. TRIAL BALANCE:');
    console.log('   GET /v1/runreports/TrialBalance?R_startDate=2025-01-01&R_endDate=2025-12-31&output-type=pdf');
    console.log('   GET /v1/accounting/glaccounts/trialbalance\n');
    
    console.log('2. INCOME STATEMENT:');
    console.log('   GET /v1/runreports/IncomeStatement?R_startDate=2025-01-01&R_endDate=2025-12-31&output-type=pdf\n');
    
    console.log('3. BALANCE SHEET:');
    console.log('   GET /v1/runreports/BalanceSheet?R_date=2025-12-31&output-type=pdf\n');
    
    console.log('4. LOAN PORTFOLIO:');
    console.log('   GET /v1/runreports/LoanAccountSchedule?R_loanId=1&output-type=pdf');
    console.log('   GET /v1/runreports/LoanRepaymentSchedule?output-type=pdf\n');
    
    // 4. Try to get trial balance
    console.log('--- GENERATING TRIAL BALANCE ---\n');
    try {
      const tbResponse = await api.get('/v1/accounting/glaccounts/trialbalance');
      const tb = tbResponse.data;
      
      console.log('Trial Balance Summary:');
      console.log(`  Total Assets: TZS ${tb.totalAssets?.toLocaleString() || 0}`);
      console.log(`  Total Liabilities: TZS ${tb.totalLiabilities?.toLocaleString() || 0}`);
      console.log(`  Total Equity: TZS ${tb.totalEquity?.toLocaleString() || 0}`);
      console.log(`  Total Income: TZS ${tb.totalIncome?.toLocaleString() || 0}`);
      console.log(`  Total Expenses: TZS ${tb.totalExpenses?.toLocaleString() || 0}`);
      
      console.log('\n✅ Trial Balance can be generated successfully');
    } catch (error) {
      console.log('⚠️ Could not generate trial balance:', error.message);
    }
    
    // 5. Generate sample report URLs
    const today = new Date().toISOString().split('T')[0];
    const yearStart = new Date().getFullYear() + '-01-01';
    
    console.log('\n--- QUICK ACCESS REPORT URLS ---\n');
    console.log('Trial Balance (Current):');
    console.log(`  ${process.env.MIFOS_BASE_URL}/v1/runreports/TrialBalance?R_startDate=${yearStart}&R_endDate=${today}&output-type=html&tenantIdentifier=zedone-uat\n`);
    
    console.log('All Loans Report:');
    console.log(`  ${process.env.MIFOS_BASE_URL}/v1/loans?tenantIdentifier=zedone-uat\n`);
    
    console.log('Journal Entries:');
    console.log(`  ${process.env.MIFOS_BASE_URL}/v1/journalentries?fromDate=${yearStart}&toDate=${today}&tenantIdentifier=zedone-uat\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

setupReports();
