// Manual cluster-mode management for the prod host (5.75.185.137).
// Not used by .github/workflows/deploy.yml, which starts/restarts the app
// directly via `pm2 start/restart server.js --name <app>`. To apply this
// file: cd /opt/ess2/backend && pm2 reload ecosystem.config.js --only ess2-backend-prod
module.exports = {
  apps: [{
    name: 'ess2-backend-prod',
    script: 'server.js',
    instances: 'max', // 4 cores on the prod host
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    time: true,
    env_file: '.env', // Load environment variables from .env file
    env: {
      NODE_ENV: 'production',
      PORT: 3002
      // NOTE: the ESS_UTUMISHI TLS chain issue (missing intermediate cert)
      // is NOT fixed via NODE_EXTRA_CA_CERTS here -- confirmed PM2 applies
      // this env block via process.env assignment from its own JS
      // process-container wrapper, which runs after Node's native TLS
      // bootstrap already read (or didn't read) that var, so it has no
      // effect regardless of restart/delete/start method. See
      // src/utils/utumishiAgent.js for the actual fix (an explicit
      // https.Agent loaded at application runtime, used by
      // callbackUtils.js and outgoingMessagesController.js).
    },
    max_memory_restart: '512M',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    exp_backoff_restart_delay: 100,
    listen_timeout: 10000, // Increased for graceful startup
    kill_timeout: 5000,
    shutdown_with_message: true // Enable graceful shutdown
  }]
};
