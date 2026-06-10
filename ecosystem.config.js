module.exports = {
  apps: [{
    name: 'ess-app',
    script: 'server.js',
    instances: 'max', // Use all CPU cores (2 vCPU = 2 instances)
    exec_mode: 'cluster', // Changed from 'fork' for load balancing
    autorestart: true,
    watch: false,
    time: true,
    env_file: '.env', // Load environment variables from .env file
    env_production: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    max_memory_restart: '512M', // Reduced from 1G (per instance, 2 instances = 1GB total)
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    exp_backoff_restart_delay: 100,
    listen_timeout: 10000, // Increased for graceful startup
    kill_timeout: 5000,
    // Graceful shutdown configuration
    // wait_ready: true, // Wait for ready signal from app - DISABLED: causing startup hang
    shutdown_with_message: true // Enable graceful shutdown
  }]
};