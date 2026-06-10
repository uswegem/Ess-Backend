# ESS Loan Status Tables Dashboard

This dashboard provides detailed table views for each loan stage/status in the ESS system.

## 📊 Dashboard Features

### Table Panels for Each Loan Status:
- **INITIAL_OFFER** - Loans that have been created but not submitted
- **OFFER_SUBMITTED** - Loans submitted to FSP for processing
- **INITIAL_APPROVAL_SENT** - Initial approval notifications sent
- **APPROVED** - Loans approved by employer
- **FINAL_APPROVAL_RECEIVED** - Final approval received from employer
- **CLIENT_CREATED** - MIFOS client accounts created
- **LOAN_CREATED** - MIFOS loan accounts created
- **DISBURSED** - Loans successfully disbursed
- **COMPLETED** - Fully repaid loans
- **REJECTED** - Loans rejected during processing
- **CANCELLED** - Loans cancelled by users or system
- **FAILED** - Loans that failed during processing
- **WAITING_FOR_LIQUIDATION** - Loans awaiting takeover processing

### Additional Analytics:
- **Loan Rejections by Actor** - Breakdown of rejections by FSP/Employee/Employer/System
- **Loan Cancellations by Actor** - Breakdown of cancellations by actor type

## 🚀 Deployment Instructions

### 1. Import Dashboard to Grafana

```bash
# Access Grafana
open http://5.75.185.137:3000/

# Login with admin/admin

# Import the dashboard:
# 1. Click "+" → "Import"
# 2. Upload file: monitoring/grafana-dashboard-loan-tables.json
# 3. Select Prometheus as data source
# 4. Click "Import"
```

### 2. Verify Data Source

Ensure Prometheus data source is configured:
- **URL**: `http://prometheus:9090`
- **Access**: Proxy
- **Scrape Target**: `135.181.33.13:3002`

### 3. Check Metrics Availability

Verify metrics are being collected:
```bash
curl http://135.181.33.13:3002/metrics | grep loan_status
```

## 📈 Metrics Used

### Prometheus Metrics:
- `loan_status_count{status="STATUS_NAME"}` - Count of loans in each status
- `loan_rejections_by_actor{actor="ACTOR_TYPE"}` - Rejection counts by actor
- `loan_cancellations_by_actor{actor="ACTOR_TYPE"}` - Cancellation counts by actor

### Update Frequency:
- Metrics update every **60 seconds**
- Dashboard refresh every **30 seconds**

## 🔧 API Endpoint

The dashboard data comes from the ESS application metrics endpoint:
```
GET /metrics
```

For detailed loan data (not used in tables but available):
```
GET /api/frontend/loan/status-statistics
```

## 📋 Loan Status Definitions

| Status | Description | Next Possible Status |
|--------|-------------|---------------------|
| INITIAL_OFFER | Created but not submitted | OFFER_SUBMITTED |
| OFFER_SUBMITTED | Submitted to FSP | INITIAL_APPROVAL_SENT |
| INITIAL_APPROVAL_SENT | Initial approval sent | APPROVED |
| APPROVED | Approved by employer | FINAL_APPROVAL_RECEIVED |
| FINAL_APPROVAL_RECEIVED | Final approval received | CLIENT_CREATED |
| CLIENT_CREATED | MIFOS client created | LOAN_CREATED |
| LOAN_CREATED | MIFOS loan created | DISBURSED |
| DISBURSED | Funds disbursed | COMPLETED |
| COMPLETED | Loan fully repaid | Terminal state |
| REJECTED | Rejected during process | Terminal state |
| CANCELLED | Cancelled by user/system | Terminal state |
| FAILED | Processing failed | Terminal state |

## 🎯 Use Cases

1. **Monitor Loan Pipeline** - Track loans at each stage
2. **Identify Bottlenecks** - Find stages with high accumulation
3. **Track Rejection/Cancellation Rates** - Monitor quality metrics
4. **Capacity Planning** - Understand system load by status
5. **SLA Monitoring** - Track loans stuck in processing stages

## 🔄 Automation

The metrics are automatically updated every 60 seconds by the ESS application. No manual intervention required.

## 📞 Support

For issues with the dashboard:
1. Check Prometheus metrics: `curl http://135.181.33.13:3002/metrics`
2. Verify Grafana data source connectivity
3. Check application logs for metric update errors