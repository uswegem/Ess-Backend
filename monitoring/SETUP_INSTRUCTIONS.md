# ESS Monitoring Integration with Existing Grafana

✅ **Monitoring integration deployed successfully!**

Your ESS application now exposes Prometheus metrics at: **http://135.181.33.13:3002/metrics**

## 📊 Next Steps to Complete Dashboard Setup

### 1. Configure Prometheus Data Source in Grafana

1. Open your Grafana instance: **http://5.75.185.137:3000/**
2. Login with your credentials
3. Go to **Configuration** → **Data Sources**
4. Click **Add data source**
5. Select **Prometheus**
6. Configure the data source:
   - **Name**: `ESS-Prometheus`
   - **URL**: `http://135.181.33.13:3002` (or your Prometheus server URL)
   - **Access**: `Server (default)`
   - **Scrape interval**: `15s`
7. Click **Save & Test**

### 2. Import the ESS Dashboard

1. In Grafana, click the **+** (plus) icon in the sidebar
2. Select **Import**
3. You have two options:
   
   **Option A: Upload JSON file**
   - Click **Upload JSON file**
   - Select `monitoring/grafana-dashboard.json`
   
   **Option B: Copy-paste JSON**
   - Copy the contents of `monitoring/grafana-dashboard.json`
   - Paste into the **Import via panel json** textarea

4. Configure the import:
   - **Name**: `ESS Loan Service Dashboard`
   - **Folder**: Choose appropriate folder
   - **Prometheus**: Select the data source you created in step 1
5. Click **Import**

### 3. Configure Prometheus to Scrape ESS Metrics

If you have your own Prometheus instance, add this job to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'ess-app'
    static_configs:
      - targets: ['135.181.33.13:3002']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s
```

Then restart Prometheus to pick up the new configuration.

## 📈 Available Metrics

Your ESS application now exposes these metrics:

### HTTP Metrics
- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - Request duration histogram

### Application Metrics  
- `loan_messages_total` - Loan messages processed by type and status
- `loan_errors_total` - Loan processing errors by type
- `database_queries_total` - Database operations by type and table

### System Metrics
- `process_memory_usage` - Memory usage in bytes
- `process_cpu_usage` - CPU usage percentage
- `nodejs_active_handles_total` - Active Node.js handles
- `nodejs_*` - Standard Node.js metrics (heap, GC, etc.)

### PM2 Metrics
- `pm2_instances` - Number of PM2 instances running

## 🔍 Verify Setup

### Test Endpoints
```bash
# Metrics endpoint
curl http://135.181.33.13:3002/metrics

# Health endpoint  
curl http://135.181.33.13:3002/health
```

### Test Loan Message Tracking
Send a loan request to see metrics being tracked:
```bash
curl -X POST -H "Content-Type: application/xml" \
  -d '<Document><Data><Header><MessageType>LOAN_CHARGES_REQUEST</MessageType>...</Header>...</Data></Document>' \
  http://135.181.33.13:3002/api/loan
```

## 🎯 Dashboard Panels

Once imported, your dashboard will show:

1. **Request Rate** - Real-time HTTP request rates  
2. **Response Time** - 95th percentile response times
3. **HTTP Status Distribution** - Status code breakdown
4. **CPU Usage** - Process CPU utilization
5. **Memory Usage** - Memory consumption over time
6. **Loan Messages by Type** - ESS message processing rates
7. **Database Query Rate** - Database performance metrics
8. **Service Uptime** - Application availability
9. **Error Count** - Error rates and counts
10. **Active Handles** - Node.js handle tracking
11. **PM2 Instances** - Process management status

## 🚨 Setting Up Alerts (Optional)

In Grafana, you can create alerts for:
- CPU usage > 80%
- Memory usage > 90% 
- Error rate > 5%
- Response time > 2 seconds
- Service downtime

## 📞 Support

If you need help with the dashboard setup:
1. Check that the metrics endpoint is accessible
2. Verify Prometheus data source connectivity
3. Ensure dashboard JSON imports correctly
4. Check Grafana logs for any errors

**Metrics URL**: http://135.181.33.13:3002/metrics  
**Your Grafana**: http://5.75.185.137:3000/