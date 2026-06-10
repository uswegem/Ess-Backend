#!/bin/bash
# Quick fix for Grafana and Admin Portal issues

echo "🚀 Fixing Grafana and Admin Portal Issues..."

# Fix 1: Configure API Proxy on Admin Server
echo "1️⃣ Configuring API proxy for admin portal..."
ssh uswege@5.75.185.137 << 'EOF'
# Backup existing nginx config
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# Add API proxy configuration
sudo tee -a /etc/nginx/sites-available/default > /dev/null << 'NGINX_CONFIG'

    # ESS API Proxy
    location /api/v1/ {
        proxy_pass http://135.181.33.13:3002/api/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # ESS Health Check Proxy
    location /health {
        proxy_pass http://135.181.33.13:3002/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
NGINX_CONFIG

# Test and reload nginx
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx configuration updated successfully"
else
    echo "❌ Nginx configuration error, restoring backup"
    sudo mv /etc/nginx/sites-available/default.backup /etc/nginx/sites-available/default
    exit 1
fi
EOF

# Fix 2: Setup Log Shipping from ESS to Grafana
echo "2️⃣ Setting up log shipping to Grafana..."
ssh miracore-prod << 'EOF'
cd /home/uswege/ess

# Download and setup Promtail if not exists
if [ ! -f "promtail-linux-amd64" ]; then
    echo "Downloading Promtail..."
    curl -s -O -L "https://github.com/grafana/loki/releases/latest/download/promtail-linux-amd64.zip"
    unzip -q promtail-linux-amd64.zip
    chmod +x promtail-linux-amd64
    rm promtail-linux-amd64.zip
fi

# Create Promtail configuration
cat > promtail-config.yml << 'PROMTAIL_CONFIG'
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://5.75.185.137:3100/loki/api/v1/push

scrape_configs:
  - job_name: ess-app-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: ess-app
          server: miracore-prod
          environment: production
          __path__: /home/uswege/ess/logs/app-*.log
          
  - job_name: ess-error-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: ess-errors
          server: miracore-prod
          environment: production
          __path__: /home/uswege/ess/logs/error-*.log
PROMTAIL_CONFIG

# Kill existing Promtail processes
pkill -f promtail-linux-amd64 || true

# Start Promtail in background
nohup ./promtail-linux-amd64 -config.file=promtail-config.yml > promtail.log 2>&1 &
echo "✅ Promtail started for log shipping"
EOF

# Fix 3: Test connections
echo "3️⃣ Testing connections..."

echo "Testing admin portal API proxy..."
if curl -f http://5.75.185.137/health --connect-timeout 10 > /dev/null 2>&1; then
    echo "✅ Admin portal API proxy working"
else
    echo "❌ Admin portal API proxy failed"
fi

echo "Testing Grafana accessibility..."
if curl -f http://5.75.185.137:3000/ --connect-timeout 10 > /dev/null 2>&1; then
    echo "✅ Grafana is accessible"
else
    echo "❌ Grafana is not accessible"
fi

echo "Testing ESS backend..."
if curl -f http://135.181.33.13:3002/health --connect-timeout 10 > /dev/null 2>&1; then
    echo "✅ ESS backend is healthy"
else
    echo "❌ ESS backend is not accessible"
fi

# Final instructions
echo ""
echo "🎉 Fix deployment complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Admin Portal: http://5.75.185.137/ (should now show live data)"
echo "2. Grafana: http://5.75.185.137:3000/ (login: admin/admin)"
echo "3. Configure Grafana data source: http://localhost:3100"
echo "4. Wait 2-3 minutes for logs to start appearing in Grafana"
echo ""
echo "🔍 Troubleshooting:"
echo "- Check admin portal logs: ssh uswege@5.75.185.137 'sudo tail -f /var/log/nginx/error.log'"
echo "- Check Promtail logs: ssh miracore-prod 'tail -f /home/uswege/ess/promtail.log'"
echo "- Check ESS logs: ssh miracore-prod 'tail -f /home/uswege/ess/logs/app-$(date +%Y-%m-%d).log'"