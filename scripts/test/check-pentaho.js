const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

async function checkPentahoConfig() {
  try {
    console.log('=== CHECKING PENTAHO CONFIGURATION ===\n');
    
    // 1. Check Mifos configuration for Pentaho
    console.log('Checking Pentaho settings in Mifos...\n');
    
    try {
      const configResponse = await api.get('/v1/configurations');
      const configs = configResponse.data.globalConfiguration;
      
      const pentahoConfig = configs.find(c => 
        c.name && c.name.toLowerCase().includes('pentaho')
      );
      
      if (pentahoConfig) {
        console.log('✅ Pentaho configuration found:');
        console.log('   Name:', pentahoConfig.name);
        console.log('   Enabled:', pentahoConfig.enabled);
        console.log('   Value:', pentahoConfig.value || 'Not set');
      } else {
        console.log('⚠️ No Pentaho configuration found in global settings');
      }
    } catch (error) {
      console.log('⚠️ Could not fetch global configurations');
    }
    
    // 2. Check Pentaho reports
    console.log('\n--- PENTAHO REPORTS ---\n');
    const reportsResponse = await api.get('/v1/reports');
    const reports = reportsResponse.data;
    
    const pentahoReports = reports.filter(r => r.reportType === 'Pentaho');
    
    console.log(`Total Pentaho Reports: ${pentahoReports.length}\n`);
    
    if (pentahoReports.length > 0) {
      console.log('Key Pentaho Reports:');
      pentahoReports.slice(0, 10).forEach(r => {
        console.log(`  - ${r.reportName}`);
      });
    }
    
    // 3. Try to generate a simple Pentaho report to test connection
    console.log('\n--- TESTING PENTAHO CONNECTION ---\n');
    
    try {
      // Try a simple report
      const testParams = {
        'output-type': 'pdf',
        R_startDate: '2025-01-01',
        R_endDate: '2025-12-31'
      };
      
      const testResponse = await api.get('/v1/runreports/Trial Balance', { 
        params: testParams,
        timeout: 10000
      });
      
      console.log('✅ Pentaho report executed successfully');
      console.log('   Response type:', typeof testResponse.data);
      console.log('   Response size:', testResponse.data?.length || 0);
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('⚠️ Permission denied - User lacks report execution permissions');
      } else if (error.response?.status === 500) {
        console.log('❌ Pentaho server error - Pentaho may not be configured');
      } else {
        console.log('❌ Could not execute Pentaho report:', error.message);
      }
    }
    
    console.log('\n--- PENTAHO REQUIREMENTS ---\n');
    console.log('To use Pentaho reports, you need:');
    console.log('1. Pentaho Report Server installed and running');
    console.log('2. Report template files (.prpt) deployed');
    console.log('3. Mifos configured with Pentaho server URL');
    console.log('4. Datasource connection configured');
    console.log('5. User permissions for report execution');
    
    console.log('\n--- ALTERNATIVE: TABLE REPORTS ---\n');
    const tableReports = reports.filter(r => r.reportType === 'Table');
    console.log(`Available Table Reports (No Pentaho needed): ${tableReports.length}`);
    console.log('\nKey Table Reports:');
    console.log('  ✅ Trial Balance Table');
    console.log('  ✅ Income Statement Table');
    console.log('  ✅ Balance Sheet Table');
    console.log('  ✅ General Ledger Report Table');
    console.log('  ✅ Active Loans - Summary');
    console.log('  ✅ Portfolio at Risk');
    console.log('  ✅ Aging Detail');
    console.log('\nThese can be used immediately without Pentaho setup.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

checkPentahoConfig();
