# ESS Loan Records Dashboard - Individual Records Export

This dashboard provides **individual loan records** in tabular format that can be exported to CSV/Excel, unlike the metrics dashboard which shows aggregated data.

## 🎯 Key Difference from Metrics Dashboard

| Feature | Metrics Dashboard | Records Dashboard (This) |
|---------|------------------|-------------------------|
| Data Type | Aggregated counts | Individual loan records |
| Export | No | Yes (CSV/Excel from Grafana or direct API) |
| Detail Level | Summary only | All loan fields |
| Data Source | Prometheus metrics | REST API + MongoDB |
| Use Case | Monitoring/alerting | Analysis/reporting/export |

## 📊 Dashboard Features

### Individual Loan Records Tables:
Each panel shows **actual loan records** with full details:
- Application Number
- Loan Number  
- Check Number
- Status
- Amount
- Purpose
- Employer Name
- Employee Details (NIN, Name, Mobile)
- MIFOS IDs (Client, Loan)
- Rejection/Cancellation Info
- Timestamps (Created, Updated, Disbursed)

### Available Tables:
- **All Loan Records** - Complete list of all loans
- **INITIAL_OFFER Loans** - Pending submissions
- **OFFER_SUBMITTED Loans** - Awaiting approval
- **DISBURSED Loans** - Successfully disbursed
- **REJECTED Loans** - With rejection reasons
- More status-specific tables as needed

## 🚀 Deployment Instructions

### 1. Deploy API Endpoint

```bash
# From local machine
cd c:\laragon\www\ess
git add src/routes/frontendApi.js
git commit -m "feat: Add loan records API endpoint for CSV export"
git push origin main

# On server
ssh uswege@135.181.33.13
cd /home/uswege/ess
git pull origin main
pm2 restart all
```

### 2. Install Grafana Infinity Plugin

The Infinity plugin allows Grafana to query REST APIs and display results in tables.

```bash
# On Grafana server (SSH to Grafana host)
ssh root@5.75.185.137

# Install plugin
grafana-cli plugins install yesoreyeram-infinity-datasource

# Restart Grafana
systemctl restart grafana-server

# Or if using Docker:
docker restart grafana
```

### 3. Configure Infinity Data Source in Grafana

1. Access Grafana: http://5.75.185.137:3000/
2. Login: admin/admin
3. Go to **Configuration** → **Data Sources**
4. Click **Add data source**
5. Search for **Infinity**
6. Click **Infinity** and configure:
   - **Name**: `Infinity`
   - **URL**: Leave empty (URLs specified per query)
   - Click **Save & Test**

### 4. Import Dashboard

```bash
# In Grafana UI:
# 1. Click "+" → "Import"
# 2. Upload file: monitoring/grafana-dashboard-loan-records-tables.json
# 3. Select "Infinity" as data source
# 4. Click "Import"
```

## 📤 Export Options

### Option 1: Export from Grafana (Recommended for UI users)

1. Open the dashboard
2. Click on any table panel
3. Click the **three dots menu** (⋮) → **Inspect** → **Data**
4. Click **Download CSV** or **Download Excel**
5. Save the file

### Option 2: Direct CSV Download from API (Recommended for automation)

Get all loans as CSV:
```bash
curl -o loans.csv "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"
```

Get specific status as CSV:
```bash
# Rejected loans
curl -o rejected-loans.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&format=csv&limit=5000"

# Disbursed loans
curl -o disbursed-loans.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=DISBURSED&format=csv&limit=5000"
```

### Option 3: Google Sheets Integration (Advanced)

If you want to auto-sync to Google Sheets:

1. **Create a Google Apps Script**:
```javascript
function importLoans() {
  var url = 'http://135.181.33.13:3002/api/frontend/loan/records?limit=1000';
  var response = UrlFetchApp.fetch(url);
  var json = JSON.parse(response.getContentText());
  var data = json.data;
  
  var sheet = SpreadsheetApp.getActiveSheet();
  sheet.clear();
  
  // Headers
  var headers = Object.keys(data[0]);
  sheet.appendRow(headers);
  
  // Data rows
  data.forEach(function(row) {
    var values = headers.map(function(header) {
      return row[header];
    });
    sheet.appendRow(values);
  });
}
```

2. **Set up automatic refresh**:
   - In Google Sheets: **Extensions** → **Apps Script**
   - Paste the code above
   - Set up a **time-driven trigger** to run every hour

## 🔧 API Endpoints

### Get Loan Records (JSON)
```
GET /api/frontend/loan/records
```

**Query Parameters:**
- `status` (optional): Filter by status (INITIAL_OFFER, DISBURSED, etc.)
- `limit` (optional): Max records (default: 1000, max: 5000)
- `offset` (optional): Pagination offset (default: 0)
- `format` (optional): 'json' or 'csv' (default: json)

**Example Requests:**
```bash
# Get all loans (JSON)
curl http://135.181.33.13:3002/api/frontend/loan/records

# Get rejected loans (JSON)
curl http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED

# Get first 100 disbursed loans (CSV)
curl http://135.181.33.13:3002/api/frontend/loan/records?status=DISBURSED&limit=100&format=csv

# Pagination - get next 1000 records
curl http://135.181.33.13:3002/api/frontend/loan/records?limit=1000&offset=1000
```

**Response Format (JSON):**
```json
{
  "success": true,
  "data": [
    {
      "applicationNumber": "ESS1234567890",
      "loanNumber": "LN001",
      "checkNumber": "CHK001",
      "status": "DISBURSED",
      "amount": 500000,
      "purpose": "Business",
      "employerName": "ABC Company",
      "employeeNIN": "CM12345678901234",
      "employeeName": "John Doe",
      "employeeMobile": "237670000000",
      "mifosClientId": "123",
      "mifosLoanId": "456",
      "rejectedBy": "",
      "rejectionReason": "",
      "cancelledBy": "",
      "cancellationReason": "",
      "failureReason": "",
      "createdAt": "2025-12-22T10:30:00.000Z",
      "updatedAt": "2025-12-22T12:45:00.000Z",
      "disbursementDate": "2025-12-22T13:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1523,
    "limit": 1000,
    "offset": 0,
    "hasMore": true
  },
  "timestamp": "2025-12-22T15:30:00.000Z"
}
```

## 📋 Available Loan Statuses

Filter by these status values:
- `INITIAL_OFFER`
- `OFFER_SUBMITTED`
- `INITIAL_APPROVAL_SENT`
- `APPROVED`
- `FINAL_APPROVAL_RECEIVED`
- `CLIENT_CREATED`
- `LOAN_CREATED`
- `DISBURSED`
- `COMPLETED`
- `REJECTED`
- `CANCELLED`
- `FAILED`
- `WAITING_FOR_LIQUIDATION`

## 🎯 Use Cases

### 1. Daily Rejected Loans Report
```bash
# Download today's rejected loans
curl -o "rejected-$(date +%Y%m%d).csv" \
  "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&format=csv&limit=5000"
```

### 2. Monthly Disbursement Report
```bash
# Get all disbursed loans as CSV
curl -o disbursed-loans.csv \
  "http://135.181.33.13:3002/api/frontend/loan/records?status=DISBURSED&format=csv&limit=5000"
```

### 3. Pending Applications Dashboard
- Use Grafana table to see all INITIAL_OFFER loans
- Click to drill down into details
- Export to Excel for follow-up

### 4. Integration with BI Tools
- Power BI: Use Web connector with API URL
- Tableau: Connect to REST API data source
- Excel: Power Query from Web

## 🔄 Automation Examples

### Scheduled CSV Export (Cron Job)
```bash
# Add to crontab: Daily at 8 AM
0 8 * * * curl -o /home/reports/loans-$(date +\%Y\%m\%d).csv "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"
```

### PowerShell Script (Windows)
```powershell
# Save as export-loans.ps1
$date = Get-Date -Format "yyyyMMdd"
$url = "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"
$output = "C:\Reports\loans-$date.csv"
Invoke-WebRequest -Uri $url -OutFile $output
```

## 🛠️ Troubleshooting

### Issue: Infinity plugin not showing data

**Solution:**
1. Check API endpoint is accessible:
   ```bash
   curl http://135.181.33.13:3002/api/frontend/loan/records
   ```
2. Verify Infinity data source is configured
3. Check panel's JSON path: should be `data` (root_selector)

### Issue: CSV export empty

**Solution:**
1. Check query limit (max 5000)
2. Verify status filter is correct
3. Test JSON endpoint first, then add `&format=csv`

### Issue: Google Sheets not updating

**Solution:**
1. Check Apps Script execution log for errors
2. Verify API endpoint is accessible from Google servers
3. Increase UrlFetchApp timeout if needed

## 📞 Support

For issues:
1. **API Issues**: Check `pm2 logs ess --lines 100`
2. **Grafana Issues**: Check Grafana logs: `journalctl -u grafana-server -f`
3. **Data Issues**: Query MongoDB directly for verification

## 🔗 Related Endpoints

- **Health Check**: `GET /api/frontend/health`
- **Metrics**: `GET /metrics` (for aggregated Prometheus metrics)
- **Status Statistics**: `GET /api/frontend/loan/status-statistics`
