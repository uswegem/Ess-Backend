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
      PORT: 3002,
      // ESS_UTUMISHI (gateway.ess.utumishi.go.tz) doesn't send its
      // intermediate cert (DigiCert Global G2 TLS RSA SHA256 2020 CA1) --
      // openssl s_client confirms only the leaf cert (depth=0), so Node
      // can't build the chain to a trusted root on its own. The DigiCert
      // root itself is standard/already trusted; supplying just the
      // missing intermediate here fixes it without weakening TLS
      // verification for anything else. Must be a real process env var --
      // dotenv/.env loads too late for Node's own TLS bootstrap to see it.
      NODE_EXTRA_CA_CERTS: '/opt/ess2/backend/certs/digicert-global-g2-tls-rsa-sha256-2020-ca1.pem'
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
