@echo off
echo 🔧 Setting up ESS Monitoring Stack...

REM Install prom-client for Node.js metrics
echo 📦 Installing prom-client dependency...
npm install prom-client

REM Create monitoring directory if it doesn't exist
if not exist monitoring mkdir monitoring

echo 🐋 Starting Docker containers for monitoring stack...
cd monitoring

REM Start the monitoring stack
docker-compose -f docker-compose-monitoring.yml up -d

echo ⏳ Waiting for services to start...
timeout /t 30

REM Check if services are running
echo 🔍 Checking service status...
docker-compose -f docker-compose-monitoring.yml ps

echo ✅ Monitoring stack setup complete!
echo.
echo 📊 Access your dashboards:
echo    Grafana:    http://localhost:3000 (admin/admin123)
echo    Prometheus: http://localhost:9090
echo.
echo 🔧 Next steps:
echo 1. Add metrics middleware to your Express app
echo 2. Import the dashboard JSON into Grafana
echo 3. Configure alerts if needed
echo.
echo 📝 Example integration in server.js:
echo    const { httpMetricsMiddleware, metricsHandler } = require('./src/middleware/metricsMiddleware');
echo    app.use(httpMetricsMiddleware);
echo    app.get('/metrics', metricsHandler);

pause