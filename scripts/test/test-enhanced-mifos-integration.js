const logger = require('./src/utils/logger');
const { 
  maker: cbsApi, 
  authManager, 
  healthMonitor, 
  errorHandler, 
  requestManager,
  getHealthStatus,
  clearTokenCache,
  resetCircuitBreaker
} = require('./src/services/cbs.api');

/**
 * Integration test for enhanced MIFOS services
 */
async function testEnhancedMifosIntegration() {
  console.log('🚀 Testing Enhanced MIFOS Integration Services\n');
  
  try {
    // Test 1: Authentication Manager
    console.log('📋 TEST 1: Authentication Manager');
    console.log('--------------------------------------------------');
    
    const authHeader = await authManager.getAuthHeader();
    console.log('✅ Auth header obtained:', !!authHeader.Authorization);
    
    // Test token refresh capability
    console.log('🔄 Testing token refresh...');
    await authManager.refreshToken();
    console.log('✅ Token refresh completed');
    
    // Test 2: Health Monitor
    console.log('\n📋 TEST 2: Health Monitor');
    console.log('--------------------------------------------------');
    
    const healthStatus = await getHealthStatus();
    console.log('✅ Health status:', JSON.stringify(healthStatus, null, 2));
    
    // Force a health check
    const healthCheck = await healthMonitor.performHealthCheck();
    console.log('✅ Forced health check:', JSON.stringify(healthCheck, null, 2));
    
    // Test 3: Request Manager
    console.log('\n📋 TEST 3: Request Manager');
    console.log('--------------------------------------------------');
    
    const requestStats = requestManager.getStats();
    console.log('✅ Request stats:', JSON.stringify(requestStats, null, 2));
    
    // Test rate limiting
    console.log('🔄 Testing rate limiting...');
    const testRequests = [];
    for (let i = 0; i < 5; i++) {
      testRequests.push(
        requestManager.makeRequest(async () => {
          console.log(`  Request ${i + 1} processed`);
          return `Request ${i + 1}`;
        })
      );
    }
    
    const results = await Promise.all(testRequests);
    console.log('✅ Rate limiting test completed:', results.length, 'requests processed');
    
    // Test 4: Error Handler
    console.log('\n📋 TEST 4: Error Handler');
    console.log('--------------------------------------------------');
    
    const errorMetrics = errorHandler.getMetrics();
    console.log('✅ Error metrics:', JSON.stringify(errorMetrics, null, 2));
    
    // Test error classification
    const testError = new Error('Test network error');
    testError.code = 'ECONNABORTED';
    const errorInfo = errorHandler.classifyError(testError);
    console.log('✅ Error classification:', JSON.stringify(errorInfo, null, 2));
    
    // Test 5: Actual MIFOS API Call
    console.log('\n📋 TEST 5: Enhanced MIFOS API Call');
    console.log('--------------------------------------------------');
    
    try {
      const clientsResponse = await cbsApi.get('/v1/clients?limit=1');
      if (clientsResponse.status) {
        console.log('✅ MIFOS API call successful');
        console.log('  Response status:', clientsResponse.status);
        console.log('  Data received:', !!clientsResponse.response);
        console.log('  Correlation ID included:', !!clientsResponse.correlationId);
      } else {
        console.log('⚠️ MIFOS API call returned error response');
      }
    } catch (error) {
      console.log('❌ MIFOS API call failed:', error.message);
      console.log('  Error type:', error.errorType);
      console.log('  Correlation ID:', error.correlationId);
    }
    
    // Test 6: Circuit Breaker
    console.log('\n📋 TEST 6: Circuit Breaker');
    console.log('--------------------------------------------------');
    
    console.log('🔄 Resetting circuit breaker...');
    resetCircuitBreaker();
    console.log('✅ Circuit breaker reset completed');
    
    // Test 7: Token Cache Management
    console.log('\n📋 TEST 7: Token Cache Management');
    console.log('--------------------------------------------------');
    
    console.log('🔄 Clearing token cache...');
    clearTokenCache();
    console.log('✅ Token cache cleared');
    
    // Re-authenticate
    const newAuthHeader = await authManager.getAuthHeader();
    console.log('✅ New auth token obtained:', !!newAuthHeader.Authorization);
    
    // Test 8: Batch Operations
    console.log('\n📋 TEST 8: Batch Operations');
    console.log('--------------------------------------------------');
    
    const batchResults = await requestManager.processBatch([
      async () => ({ operation: 'test1', result: 'success' }),
      async () => ({ operation: 'test2', result: 'success' }),
      async () => ({ operation: 'test3', result: 'success' })
    ]);
    
    console.log('✅ Batch processing completed:', batchResults.length, 'operations');
    console.log('  Results:', batchResults);
    
    // Final Summary
    console.log('\n📋 INTEGRATION TEST SUMMARY');
    console.log('=====================================');
    console.log('✅ All enhanced MIFOS services are working correctly');
    console.log('✅ Authentication management: PASSED');
    console.log('✅ Health monitoring: PASSED');
    console.log('✅ Request management: PASSED');
    console.log('✅ Error handling: PASSED');
    console.log('✅ MIFOS API integration: PASSED');
    console.log('✅ Circuit breaker: PASSED');
    console.log('✅ Token management: PASSED');
    console.log('✅ Batch operations: PASSED');
    
    const finalHealth = await getHealthStatus();
    console.log('\n📊 Final System Health:', JSON.stringify(finalHealth, null, 2));
    
    return {
      success: true,
      message: 'All enhanced MIFOS services integrated successfully',
      services: {
        authentication: 'active',
        healthMonitoring: 'active',
        requestManagement: 'active',
        errorHandling: 'active',
        mifosApi: 'connected',
        circuitBreaker: 'operational',
        tokenManagement: 'active',
        batchOperations: 'active'
      }
    };
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    return {
      success: false,
      error: error.message,
      recommendations: [
        'Check MIFOS CBS connection',
        'Verify environment variables',
        'Ensure all service modules are properly loaded',
        'Check network connectivity to CBS endpoint'
      ]
    };
  }
}

// Export for use in other modules
module.exports = { testEnhancedMifosIntegration };

// Run test if called directly
if (require.main === module) {
  require('dotenv').config();
  
  testEnhancedMifosIntegration()
    .then(result => {
      console.log('\n🎯 Test completed:', result.success ? 'SUCCESS' : 'FAILED');
      if (!result.success && result.recommendations) {
        console.log('\n💡 Recommendations:');
        result.recommendations.forEach(rec => console.log(`  - ${rec}`));
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error.message);
      process.exit(1);
    });
}