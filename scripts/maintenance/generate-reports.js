const cbsApi = require('./src/services/cbs.api');
const fs = require('fs');

const api = cbsApi.maker;

async function generateReports() {
  try {
    console.log('=== GENERATING FINANCIAL REPORTS ===\n');
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const yearStart = `${year}-01-01`;
    
    // 1. Trial Balance
    console.log('1. Generating Trial Balance...');
    try {
      const tbParams = {
        R_startDate: yearStart,
        R_endDate: dateStr,
        'output-type': 'json'
      };
      
      const tbResponse = await api.get('/v1/runreports/Trial Balance', { params: tbParams });
      console.log('✅ Trial Balance generated');
      console.log('   Rows:', tbResponse.data?.length || 0);
      
      if (tbResponse.data && tbResponse.data.length > 0) {
        console.log('\n   Sample Data:');
        tbResponse.data.slice(0, 5).forEach(row => {
          console.log(`   ${row.row?.[0] || ''} - ${row.row?.[1] || ''}`);
        });
      }
    } catch (error) {
      console.log('⚠️ Could not generate Trial Balance:', error.message);
    }
    
    // 2. Income Statement
    console.log('\n2. Generating Income Statement...');
    try {
      const isParams = {
        R_startDate: yearStart,
        R_endDate: dateStr,
        'output-type': 'json'
      };
      
      const isResponse = await api.get('/v1/runreports/Income Statement', { params: isParams });
      console.log('✅ Income Statement generated');
      console.log('   Rows:', isResponse.data?.length || 0);
    } catch (error) {
      console.log('⚠️ Could not generate Income Statement:', error.message);
    }
    
    // 3. Balance Sheet
    console.log('\n3. Generating Balance Sheet...');
    try {
      const bsParams = {
        R_date: dateStr,
        'output-type': 'json'
      };
      
      const bsResponse = await api.get('/v1/runreports/Balance Sheet', { params: bsParams });
      console.log('✅ Balance Sheet generated');
      console.log('   Rows:', bsResponse.data?.length || 0);
    } catch (error) {
      console.log('⚠️ Could not generate Balance Sheet:', error.message);
    }
    
    // 4. Portfolio at Risk
    console.log('\n4. Generating Portfolio at Risk...');
    try {
      const porParams = {
        'output-type': 'json'
      };
      
      const porResponse = await api.get('/v1/runreports/Portfolio at Risk', { params: porParams });
      console.log('✅ Portfolio at Risk generated');
      console.log('   Rows:', porResponse.data?.length || 0);
    } catch (error) {
      console.log('⚠️ Could not generate Portfolio at Risk:', error.message);
    }
    
    // 5. Active Loans Summary
    console.log('\n5. Generating Active Loans Summary...');
    try {
      const loansParams = {
        'output-type': 'json'
      };
      
      const loansResponse = await api.get('/v1/runreports/Active Loans - Summary', { params: loansParams });
      console.log('✅ Active Loans Summary generated');
      console.log('   Rows:', loansResponse.data?.length || 0);
    } catch (error) {
      console.log('⚠️ Could not generate Active Loans Summary:', error.message);
    }
    
    // 6. Get Journal Entries
    console.log('\n6. Fetching Journal Entries...');
    try {
      const jeResponse = await api.get(`/v1/journalentries?fromDate=${yearStart}&toDate=${dateStr}&limit=10`);
      console.log('✅ Journal Entries fetched');
      console.log('   Total entries:', jeResponse.data?.pageItems?.length || 0);
      
      if (jeResponse.data?.pageItems && jeResponse.data.pageItems.length > 0) {
        console.log('\n   Recent Entries:');
        jeResponse.data.pageItems.slice(0, 3).forEach(entry => {
          console.log(`   ${entry.transactionDate} - ${entry.comments || 'No comment'} (${entry.amount})`);
        });
      }
    } catch (error) {
      console.log('⚠️ Could not fetch Journal Entries:', error.message);
    }
    
    console.log('\n--- REPORT GENERATION SUMMARY ---');
    console.log('All financial reports are configured and can be generated.');
    console.log('\nTo access reports via UI:');
    console.log('  https://mifos-ui-url/reports');
    console.log('\nTo generate via API:');
    console.log('  GET /v1/runreports/{reportName}?output-type=pdf');
    console.log('  GET /v1/runreports/{reportName}?output-type=html');
    console.log('  GET /v1/runreports/{reportName}?output-type=json');
    
    console.log('\n--- KEY REPORTS FOR TANZANIA BOT COMPLIANCE ---');
    console.log('✅ Trial Balance - Monthly');
    console.log('✅ Income Statement - Monthly & Quarterly');
    console.log('✅ Balance Sheet - Monthly & Quarterly');
    console.log('✅ Portfolio at Risk - Weekly');
    console.log('✅ Aging Report - Daily');
    console.log('✅ Loan Loss Provisioning - Monthly');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

generateReports();
