#!/usr/bin/env node

/**
 * Enhanced Connectivity Monitor for Utumishi ESS Integration
 * 
 * This script provides multiple layers of connectivity maintenance:
 * 1. Network-level monitoring (IPSec tunnel)
 * 2. Application-level keep-alive
 * 3. Automatic recovery mechanisms
 * 4. Comprehensive logging and alerting
 */

const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ConnectivityMonitor {
  constructor() {
    this.config = {
      utumishiIP: '154.118.230.140',
      utumishiPort: '9802',
      endpoint: 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume',
      checkInterval: 30000, // 30 seconds
      pingTimeout: 10000,   // 10 seconds
      maxRetries: 3,
      logFile: '/home/uswege/ess/logs/connectivity-monitor.log',
      alertThreshold: 5 // Alert after 5 consecutive failures
    };

    this.state = {
      isRunning: false,
      consecutiveFailures: 0,
      lastSuccess: null,
      lastFailure: null,
      totalChecks: 0,
      successCount: 0
    };

    this.intervalId = null;
  }

  /**
   * Start monitoring connectivity
   */
  start() {
    if (this.state.isRunning) {
      this.log('WARNING: Monitor already running');
      return;
    }

    this.log('INFO: Starting Enhanced Connectivity Monitor');
    this.log(`INFO: Target: ${this.config.endpoint}`);
    this.log(`INFO: Check interval: ${this.config.checkInterval / 1000}s`);
    
    this.state.isRunning = true;
    
    // Initial check
    this.performHealthCheck();
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    this.log('SUCCESS: Connectivity monitor started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.state.isRunning) {
      this.log('WARNING: Monitor not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state.isRunning = false;
    this.log('INFO: Connectivity monitor stopped');
  }

  /**
   * Comprehensive health check
   */
  async performHealthCheck() {
    this.state.totalChecks++;
    const timestamp = new Date().toISOString();
    
    try {
      // Level 1: Check IPSec tunnel status
      const tunnelStatus = await this.checkIPSecTunnel();
      
      // Level 2: Test network connectivity
      const networkStatus = await this.checkNetworkConnectivity();
      
      // Level 3: Test application endpoint
      const appStatus = await this.checkApplicationEndpoint();
      
      if (tunnelStatus && networkStatus && appStatus) {
        this.handleSuccess();
      } else {
        this.handleFailure({
          tunnel: tunnelStatus,
          network: networkStatus,
          application: appStatus
        });
      }
      
    } catch (error) {
      this.handleFailure({ error: error.message });
    }
  }

  /**
   * Check IPSec tunnel status
   */
  async checkIPSecTunnel() {
    try {
      const output = execSync('sudo ipsec status', { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      const tunnelCount = (output.match(/ESTABLISHED|INSTALLED/g) || []).length;
      const isHealthy = tunnelCount >= 4;
      
      if (!isHealthy) {
        this.log(`WARNING: Only ${tunnelCount} IPSec tunnels active (expected 4+)`);
      }
      
      return isHealthy;
    } catch (error) {
      this.log(`ERROR: Failed to check IPSec status: ${error.message}`);
      return false;
    }
  }

  /**
   * Check basic network connectivity to Utumishi
   */
  async checkNetworkConnectivity() {
    try {
      execSync(`ping -c 1 -W 3 ${this.config.utumishiIP}`, { 
        encoding: 'utf8',
        timeout: 5000
      });
      return true;
    } catch (error) {
      this.log(`ERROR: Network ping failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check application endpoint availability
   */
  async checkApplicationEndpoint() {
    try {
      const response = await axios.get(this.config.endpoint, {
        timeout: this.config.pingTimeout,
        validateStatus: (status) => status < 600 // Accept any status < 600
      });
      
      // Any response (even error) means connectivity exists
      return true;
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return false;
      }
      // Other errors might still indicate connectivity exists
      return true;
    }
  }

  /**
   * Handle successful connectivity check
   */
  handleSuccess() {
    this.state.consecutiveFailures = 0;
    this.state.lastSuccess = new Date();
    this.state.successCount++;
    
    const uptime = this.calculateUptime();
    this.log(`SUCCESS: All connectivity checks passed (${uptime}% uptime)`);
  }

  /**
   * Handle connectivity failure
   */
  handleFailure(details) {
    this.state.consecutiveFailures++;
    this.state.lastFailure = new Date();
    
    this.log(`FAILURE: Connectivity check failed (${this.state.consecutiveFailures}/${this.config.alertThreshold})`);
    this.log(`DETAILS: ${JSON.stringify(details)}`);
    
    // Trigger recovery if threshold exceeded
    if (this.state.consecutiveFailures >= this.config.alertThreshold) {
      this.triggerRecovery();
    }
  }

  /**
   * Trigger automatic recovery procedures
   */
  async triggerRecovery() {
    this.log('CRITICAL: Triggering automatic recovery procedures');
    
    try {
      // Step 1: Restart IPSec tunnel
      this.log('RECOVERY: Restarting IPSec tunnel...');
      execSync('sudo ipsec restart', { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      // Wait for tunnel to establish
      await this.sleep(30000);
      
      // Step 2: Verify tunnel restoration
      const tunnelRestored = await this.checkIPSecTunnel();
      
      if (tunnelRestored) {
        this.log('SUCCESS: IPSec tunnel restored');
        
        // Reset failure counter
        this.state.consecutiveFailures = 0;
        
        // Test connectivity again
        setTimeout(() => {
          this.performHealthCheck();
        }, 10000);
        
      } else {
        this.log('CRITICAL: IPSec tunnel recovery failed');
        this.sendCriticalAlert();
      }
      
    } catch (error) {
      this.log(`ERROR: Recovery procedure failed: ${error.message}`);
      this.sendCriticalAlert();
    }
  }

  /**
   * Send critical alert (implement as needed)
   */
  sendCriticalAlert() {
    const alert = {
      timestamp: new Date().toISOString(),
      service: 'ConnectivityMonitor',
      level: 'CRITICAL',
      message: 'Automatic recovery failed - manual intervention required',
      consecutiveFailures: this.state.consecutiveFailures,
      lastSuccess: this.state.lastSuccess,
      lastFailure: this.state.lastFailure
    };

    this.log(`ALERT: ${JSON.stringify(alert)}`);
    
    // TODO: Implement actual alerting mechanism
    // - Email notification
    // - SMS alert
    // - Slack webhook
    // - SNMP trap
  }

  /**
   * Calculate uptime percentage
   */
  calculateUptime() {
    if (this.state.totalChecks === 0) return 100;
    return ((this.state.successCount / this.state.totalChecks) * 100).toFixed(2);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      ...this.state,
      uptime: this.calculateUptime(),
      config: this.config
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging utility
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    console.log(logEntry);
    
    // Write to log file
    try {
      fs.appendFileSync(this.config.logFile, logEntry + '\n');
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new ConnectivityMonitor();
  
  // Handle command line arguments
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      monitor.start();
      break;
    case 'stop':
      monitor.stop();
      process.exit(0);
    case 'status':
      console.log(JSON.stringify(monitor.getStatus(), null, 2));
      process.exit(0);
    case 'check':
      monitor.performHealthCheck().then(() => process.exit(0));
      break;
    default:
      console.log('Usage: node connectivity-monitor.js [start|stop|status|check]');
      process.exit(1);
  }
  
  // Handle shutdown gracefully
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down...');
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    monitor.stop();
    process.exit(0);
  });
}

module.exports = ConnectivityMonitor;