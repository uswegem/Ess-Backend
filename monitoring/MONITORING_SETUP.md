# ESS Loan Service Monitoring Dashboard

This monitoring setup provides comprehensive observability for the ESS Loan Service application similar to the Grafana dashboard shown in your screenshot.

## 📊 Dashboard Features

The dashboard includes the following panels:

1. **Request Rate** - HTTP requests per second
2. **Response Time** - 95th percentile response times
3. **HTTP Status Codes** - Distribution of response codes
4. **CPU Usage** - Process CPU utilization
5. **Memory Usage** - Process memory consumption
6. **Loan Messages by Type** - Rate of different loan message types
7. **Database Query Rate** - Database operations per second
8. **Service Uptime** - Application availability percentage
9. **Error Count** - Total error rate
10. **Active Handles** - Node.js active handles
11. **PM2 Instances** - Number of running PM2 instances

## 🚀 Quick Setup

### Prerequisites

- Docker and Docker Compose installed
- Node.js application running
- npm package manager

### 1. Install Dependencies

```bash
npm install prom-client
```

### 2. Start Monitoring Stack

**On Windows:**
```cmd
cd monitoring
setup-monitoring.bat
```

**On Linux/Mac:**
```bash
cd monitoring
chmod +x setup-monitoring.sh
./setup-monitoring.sh
```

**Manual Docker setup:**
```bash
cd monitoring
docker-compose -f docker-compose-monitoring.yml up -d
```

### 3. Integrate Metrics in Your Application

Add to your `server.js` or main application file:

```javascript
const { 
    httpMetricsMiddleware, 
    metricsHandler,
    trackLoanMessage,
    trackLoanError,
    trackDatabaseQuery 
} = require('./src/middleware/metricsMiddleware');

// Add metrics middleware
app.use(httpMetricsMiddleware);

// Add metrics endpoint
app.get('/metrics', metricsHandler);

// Track loan messages in your handlers
const handleLoanChargesRequest = async (parsedData, res) => {
    try {
        // Your existing logic
        trackLoanMessage('LOAN_CHARGES_REQUEST', 'success');
    } catch (error) {
        trackLoanError('processing_error', 'LOAN_CHARGES_REQUEST');
        throw error;
    }
};

// Track database operations
const saveLoanData = async (data) => {
    trackDatabaseQuery('INSERT', 'loans');
    // Your database logic
};
```

### 4. Access Dashboards

- **Grafana Dashboard**: http://localhost:3000
  - Username: `admin`
  - Password: `admin123`
- **Prometheus**: http://localhost:9090

### 5. Import Dashboard

1. Open Grafana at http://localhost:3000
2. Login with admin/admin123
3. Go to "+" → "Import"
4. Upload `grafana-dashboard.json` or copy its contents
5. Select Prometheus as the datasource

## 📈 Metrics Collected

### HTTP Metrics
- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - Request duration histogram

### Application Metrics
- `loan_messages_total` - Loan messages by type and status
- `loan_errors_total` - Loan processing errors
- `database_queries_total` - Database operations

### System Metrics
- `process_memory_usage` - Memory usage in bytes
- `process_cpu_usage` - CPU usage percentage
- `nodejs_active_handles_total` - Active Node.js handles
- `pm2_instances` - PM2 instance count

### Node.js Default Metrics
- Garbage collection metrics
- Event loop lag
- Heap usage
- Process uptime

## 🔧 Configuration

### Prometheus Configuration
Edit `prometheus.yml` to adjust:
- Scrape intervals
- Target endpoints
- Retention policies

### Grafana Configuration
- Dashboards are provisioned automatically
- Datasources are configured via `grafana-datasources.yml`
- Additional dashboards can be added to the provisioning folder

## 📊 Dashboard Panels Explained

### Request Rate Panel
Shows the rate of incoming HTTP requests, useful for understanding traffic patterns.

### Response Time Gauge
Displays the 95th percentile response time, indicating performance under load.

### Status Code Distribution
Pie chart showing the distribution of HTTP response codes (200, 404, 500, etc.).

### CPU and Memory Usage
Time series charts showing resource utilization over time.

### Loan Message Types
Tracks the rate of different loan message types being processed.

### Database Query Rate
Monitors database activity and potential bottlenecks.

### Service Health Indicators
- Uptime percentage
- Error counts
- System resource usage

## 🚨 Alerting (Optional)

To set up alerts:

1. Configure Grafana alert rules
2. Add notification channels (Slack, email, etc.)
3. Set thresholds for critical metrics

Example alert conditions:
- CPU usage > 80%
- Memory usage > 90%
- Error rate > 5%
- Response time > 2 seconds

## 🛠️ Troubleshooting

### Metrics Not Showing
1. Check if `/metrics` endpoint is accessible
2. Verify Prometheus is scraping the target
3. Check Docker container logs

### Dashboard Empty
1. Ensure Prometheus is collecting data
2. Verify datasource configuration in Grafana
3. Check metric names match the queries

### Performance Impact
The monitoring overhead is minimal, but if concerned:
- Increase scrape intervals
- Reduce metric cardinality
- Disable unnecessary default metrics

## 📝 Development Notes

### Adding Custom Metrics
```javascript
const customCounter = new promClient.Counter({
    name: 'custom_operations_total',
    help: 'Total custom operations',
    labelNames: ['operation_type']
});

// Usage
customCounter.labels('loan_calculation').inc();
```

### Metric Best Practices
- Use descriptive names with units
- Keep label cardinality low
- Avoid high-frequency updates
- Use appropriate metric types (Counter, Gauge, Histogram)

## 🔒 Security

- Change default Grafana credentials
- Restrict access to monitoring endpoints
- Use authentication for production deployments
- Monitor access logs