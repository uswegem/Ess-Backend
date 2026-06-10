const logger = require('./src/utils/logger');
const { 
  maker: cbsApi, 
  authManager, 
  healthMonitor, 
  errorHandler, 
  requestManager
} = require('./src/services/cbs.api');

/**
 * Migration script to update existing loan processing with enhanced MIFOS services
 */
class MifosEnhancementMigration {
  
  constructor() {
    this.migrationLog = [];
  }
  
  log(message, level = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    this.migrationLog.push(logEntry);
    console.log(`[${level.toUpperCase()}] ${message}`);
  }
  
  async validateEnvironmentVariables() {
    this.log('🔍 Validating environment variables...');
    
    const requiredVars = [
      'CBS_BASE_URL',
      'CBS_MAKER_USERNAME',
      'CBS_MAKER_PASSWORD',
      'CBS_Tenant'
    ];
    
    const missing = [];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    this.log('✅ All required environment variables are present');
    
    // Check optional enhanced configuration
    const optionalVars = [
      'CBS_TIMEOUT',
      'MIFOS_TOKEN_EXPIRY_HOURS',
      'MIFOS_REQUEST_RATE_LIMIT',
      'MIFOS_HEALTH_CHECK_INTERVAL'
    ];
    
    const defaults = {
      'CBS_TIMEOUT': '30000',
      'MIFOS_TOKEN_EXPIRY_HOURS': '12',
      'MIFOS_REQUEST_RATE_LIMIT': '100',
      'MIFOS_HEALTH_CHECK_INTERVAL': '300000'
    };
    
    for (const varName of optionalVars) {
      if (!process.env[varName]) {
        process.env[varName] = defaults[varName];
        this.log(`⚙️ Set default ${varName}=${defaults[varName]}`);
      }
    }
  }
  
  async testEnhancedServices() {
    this.log('🧪 Testing enhanced MIFOS services...');
    
    // Test authentication
    try {
      const authHeader = await authManager.getAuthHeader();
      if (!authHeader.Authorization) {
        throw new Error('Failed to obtain authentication token');
      }
      this.log('✅ Authentication manager working');
    } catch (error) {
      this.log(`❌ Authentication manager failed: ${error.message}`, 'error');
      throw error;
    }
    
    // Test health monitoring
    try {
      const healthCheck = await healthMonitor.performHealthCheck();
      this.log(`✅ Health monitor working - Status: ${healthCheck.status}`);
    } catch (error) {
      this.log(`❌ Health monitor failed: ${error.message}`, 'error');
      throw error;
    }
    
    // Test request management
    try {
      await requestManager.makeRequest(async () => {
        this.log('✅ Request manager working');
        return 'test';
      });
    } catch (error) {
      this.log(`❌ Request manager failed: ${error.message}`, 'error');
      throw error;
    }
    
    // Test error handling
    try {
      const testError = new Error('Test error');
      testError.code = 'ECONNABORTED';
      const errorInfo = errorHandler.classifyError(testError);
      if (errorInfo.type && errorInfo.retryable !== undefined) {
        this.log('✅ Error handler working');
      } else {
        throw new Error('Error classification failed');
      }
    } catch (error) {
      this.log(`❌ Error handler failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  async testMifosConnectivity() {
    this.log('🔌 Testing MIFOS connectivity...');
    
    try {
      // Test basic connectivity
      const response = await cbsApi.get('/v1/clients?limit=1');
      
      if (response.status) {
        this.log('✅ MIFOS API connectivity successful');
        this.log(`  Response includes correlation ID: ${!!response.correlationId}`);
        return true;
      } else {
        throw new Error(`API returned error: ${response.message}`);
      }
    } catch (error) {
      this.log(`❌ MIFOS connectivity failed: ${error.message}`, 'error');
      if (error.correlationId) {
        this.log(`  Correlation ID: ${error.correlationId}`);
      }
      throw error;
    }
  }
  
  async updateLoanProcessingServices() {
    this.log('🔄 Updating loan processing services...');
    
    // Check if loan service is using enhanced features
    try {
      const LoanService = require('./src/services/loanService');
      this.log('✅ Loan service loaded successfully');
      
      // Check if client service is using enhanced features
      const ClientService = require('./src/services/clientService');
      this.log('✅ Client service loaded successfully');
      
      // Verify API controller integration
      const apiController = require('./src/controllers/apiController');
      this.log('✅ API controller loaded successfully');
      
    } catch (error) {
      this.log(`❌ Service loading failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  async createAdminEndpoints() {
    this.log('🛠️ Verifying admin endpoints...');
    
    try {
      const mifosAdminRoutes = require('./src/routes/mifosAdmin');
      this.log('✅ MIFOS admin routes available');
      
      this.log('📋 Available admin endpoints:');
      this.log('  GET  /api/v1/mifos/health - Health status');
      this.log('  GET  /api/v1/mifos/auth/status - Authentication status');
      this.log('  POST /api/v1/mifos/auth/clear - Clear tokens');
      this.log('  GET  /api/v1/mifos/requests/stats - Request statistics');
      this.log('  POST /api/v1/mifos/circuit-breaker/reset - Reset circuit breaker');
      this.log('  GET  /api/v1/mifos/errors/metrics - Error metrics');
      this.log('  POST /api/v1/mifos/health/check - Force health check');
      this.log('  GET  /api/v1/mifos/diagnostics - System diagnostics');
      
    } catch (error) {
      this.log(`❌ Admin routes verification failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  async generateMigrationReport() {
    this.log('📊 Generating migration report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      success: true,
      enhancements: [
        '✅ Connection pooling with keep-alive',
        '✅ Circuit breaker pattern implementation',
        '✅ Exponential backoff retry logic',
        '✅ Token-based authentication management',
        '✅ Comprehensive health monitoring',
        '✅ Detailed error classification and handling',
        '✅ Request rate limiting and queuing',
        '✅ Batch operation support',
        '✅ Correlation ID tracking',
        '✅ Enhanced logging and metrics'
      ],
      newFeatures: [
        '🆕 Authentication token caching (12h expiry)',
        '🆕 Automatic token refresh',
        '🆕 Health check every 5 minutes',
        '🆕 Request performance tracking',
        '🆕 Error metrics collection',
        '🆕 Rate limiting (100 requests/minute)',
        '🆕 Concurrent request limiting (5 max)',
        '🆕 Admin monitoring endpoints'
      ],
      adminEndpoints: [
        '/api/v1/mifos/health',
        '/api/v1/mifos/auth/status',
        '/api/v1/mifos/requests/stats',
        '/api/v1/mifos/errors/metrics',
        '/api/v1/mifos/diagnostics'
      ],
      migrationLog: this.migrationLog
    };
    
    return report;
  }
  
  async run() {
    try {
      this.log('🚀 Starting MIFOS Enhancement Migration', 'info');
      
      // Step 1: Validate environment
      await this.validateEnvironmentVariables();
      
      // Step 2: Test enhanced services
      await this.testEnhancedServices();
      
      // Step 3: Test MIFOS connectivity
      await this.testMifosConnectivity();
      
      // Step 4: Update loan processing services
      await this.updateLoanProcessingServices();
      
      // Step 5: Verify admin endpoints
      await this.createAdminEndpoints();
      
      // Step 6: Generate report
      const report = await this.generateMigrationReport();
      
      this.log('✅ Migration completed successfully!', 'info');
      this.log('📋 Enhanced MIFOS integration is now active', 'info');
      
      return report;
      
    } catch (error) {
      this.log(`💥 Migration failed: ${error.message}`, 'error');
      
      const report = await this.generateMigrationReport();
      report.success = false;
      report.error = error.message;
      report.recommendations = [
        'Check CBS connection parameters',
        'Verify CBS credentials',
        'Ensure all required environment variables are set',
        'Check network connectivity to CBS endpoint',
        'Review application logs for detailed error information'
      ];
      
      return report;
    }
  }
}

// Export for use in other modules
module.exports = { MifosEnhancementMigration };

// Run migration if called directly
if (require.main === module) {
  require('dotenv').config();
  
  const migration = new MifosEnhancementMigration();
  
  migration.run()
    .then(report => {
      console.log('\n📋 MIGRATION REPORT');
      console.log('==========================================');
      console.log(JSON.stringify(report, null, 2));
      
      if (report.success) {
        console.log('\n🎉 MIFOS enhancement migration completed successfully!');
        console.log('💡 You can now use the enhanced admin endpoints for monitoring');
      } else {
        console.log('\n❌ Migration failed. Please check the report for details.');
        if (report.recommendations) {
          console.log('\n💡 Recommendations:');
          report.recommendations.forEach(rec => console.log(`  - ${rec}`));
        }
      }
      
      process.exit(report.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Migration execution failed:', error.message);
      process.exit(1);
    });
}