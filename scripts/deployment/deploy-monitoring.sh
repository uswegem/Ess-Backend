#!/bin/bash

echo "🚀 Deploying ESS Monitoring Integration..."

# Install prom-client dependency
npm install prom-client

# Deploy updated files to production
echo "📡 Deploying updated server.js and metrics middleware..."
scp server.js uswege@135.181.33.13:/home/uswege/ess/server.js
scp src/middleware/metricsMiddleware.js uswege@135.181.33.13:/home/uswege/ess/src/middleware/metricsMiddleware.js
scp src/controllers/handlers/loanChargesHandler.js uswege@135.181.33.13:/home/uswege/ess/src/controllers/handlers/loanChargesHandler.js

# Restart the ESS application
echo "🔄 Restarting ESS application..."
ssh uswege@135.181.33.13 "cd /home/uswege/ess && npm install prom-client && pm2 restart ess-app"

echo "⏳ Waiting for service to restart..."
sleep 15

# Test metrics endpoint
echo "✅ Testing metrics endpoint..."
curl -s http://135.181.33.13:3002/metrics | head -10

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Next steps:"
echo "1. Open Grafana: http://5.75.185.137:3000/"
echo "2. Import dashboard: monitoring/grafana-dashboard.json"
echo "3. Add Prometheus datasource pointing to ESS metrics"
echo "4. Configure Prometheus to scrape: http://135.181.33.13:3002/metrics"
echo ""
echo "🔍 Verify endpoints:"
echo "   Metrics: http://135.181.33.13:3002/metrics"
echo "   Health:  http://135.181.33.13:3002/health"