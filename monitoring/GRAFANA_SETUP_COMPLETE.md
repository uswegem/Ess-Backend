# ✅ Grafana Infinity Plugin Setup - COMPLETE

## Status: Plugin Installed Successfully

- **Plugin**: Infinity Data Source v3.6.0
- **Grafana**: Running at http://5.75.185.137:3000/
- **Status**: ✅ Installed and Running

## Next Steps: Configure Dashboard in Grafana UI

### Step 1: Add Infinity Data Source

1. **Open Grafana**: http://5.75.185.137:3000/
2. **Login**: 
   - Username: `admin`
   - Password: `admin`
3. **Navigate**: Click ☰ menu → **Connections** → **Data sources**
4. **Add**: Click **Add data source**
5. **Search**: Type "Infinity" in the search box
6. **Select**: Click on **Infinity** datasource
7. **Configure**:
   - **Name**: Leave as `Infinity` (or rename to `ESS-API`)
   - **URL**: Leave blank (URLs are specified in each panel)
   - **Auth**: None needed
8. **Save**: Click **Save & Test**
9. **Verify**: Should show "Data source is working"

### Step 2: Import Loan Records Dashboard

1. **In Grafana**: Click **☰** → **Dashboards**
2. **Click**: **New** → **Import**
3. **Upload**: Click **Upload JSON file**
4. **Select**: `monitoring/grafana-dashboard-loan-records-tables.json` from your computer
5. **Configure Import**:
   - **Name**: "ESS Loan Records - Individual Records (Exportable)"
   - **Folder**: Choose or create "ESS Monitoring"
   - **Data Source**: Select **Infinity** from dropdown
6. **Click**: **Import**

### Step 3: View Your Loan Data

The dashboard will show these tables:

1. **All Loan Records** - Complete list (up to 1000 records)
2. **INITIAL_OFFER Loans** - Pending submissions
3. **OFFER_SUBMITTED Loans** - Awaiting approval
4. **DISBURSED Loans** - Successfully disbursed
5. **REJECTED Loans** - With rejection reasons

### Step 4: Export Data from Grafana

On any table panel:

1. **Click** the panel title
2. **Click** the **⋮** (three dots) menu
3. **Select**: **Inspect** → **Data**
4. **Download**: 
   - Click **Download CSV** for Excel
   - Or **Download log** for JSON

## Alternative: Direct CSV Export (No Grafana Needed)

If you prefer direct downloads without using Grafana:

### Download All Loans
```bash
curl -o loans.csv "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"
```

### Download by Status
```bash
# Rejected loans
curl -o rejected.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&format=csv"

# Disbursed loans
curl -o disbursed.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=DISBURSED&format=csv"

# All other statuses
curl -o initial.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=INITIAL_OFFER&format=csv"
```

### Windows PowerShell
```powershell
# Download to Downloads folder and open in Excel
$file = "$env:USERPROFILE\Downloads\loans.csv"
Invoke-WebRequest -Uri "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000" -OutFile $file
Start-Process excel $file
```

## 📊 Available Statuses for Filtering

- `INITIAL_OFFER` - Created but not submitted
- `OFFER_SUBMITTED` - Submitted to FSP
- `INITIAL_APPROVAL_SENT` - Initial approval sent
- `APPROVED` - Approved by employer
- `FINAL_APPROVAL_RECEIVED` - Final approval received
- `CLIENT_CREATED` - MIFOS client created
- `LOAN_CREATED` - MIFOS loan created
- `DISBURSED` - Funds disbursed
- `COMPLETED` - Loan fully repaid
- `REJECTED` - Rejected during process
- `CANCELLED` - Cancelled by user/system
- `FAILED` - Processing failed
- `WAITING_FOR_LIQUIDATION` - Awaiting takeover

## 🔧 API Endpoints Reference

### Get Individual Records (JSON)
```
GET http://135.181.33.13:3002/api/frontend/loan/records
```

**Query Parameters:**
- `status` - Filter by loan status (optional)
- `limit` - Max records (default: 1000, max: 5000)
- `offset` - Pagination offset (default: 0)
- `format` - 'json' or 'csv' (default: 'json')

### Examples:

**JSON (for API consumers):**
```bash
# All loans
curl "http://135.181.33.13:3002/api/frontend/loan/records?limit=100"

# Filtered by status
curl "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&limit=100"

# With pagination
curl "http://135.181.33.13:3002/api/frontend/loan/records?limit=100&offset=100"
```

**CSV (for Excel/reporting):**
```bash
# Direct download
curl -o output.csv "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"

# With status filter
curl -o rejected.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&format=csv"
```

## 📋 Fields Included in Export

Each record contains 20 fields:

| Field | Description |
|-------|-------------|
| applicationNumber | ESS application number |
| loanNumber | ESS loan number alias |
| checkNumber | ESS check number |
| status | Current loan status |
| amount | Loan amount |
| purpose | Loan purpose |
| employerName | Employer name |
| employeeNIN | Employee National ID |
| employeeName | Employee full name |
| employeeMobile | Employee mobile number |
| mifosClientId | MIFOS client ID |
| mifosLoanId | MIFOS loan ID |
| rejectedBy | Who rejected (if applicable) |
| rejectionReason | Rejection reason |
| cancelledBy | Who cancelled (if applicable) |
| cancellationReason | Cancellation reason |
| failureReason | System failure reason |
| createdAt | Creation timestamp |
| updatedAt | Last update timestamp |
| disbursementDate | Disbursement date |

## 🎯 Common Use Cases

### 1. Daily Rejected Loans Report
```bash
#!/bin/bash
# Save as: daily-rejected.sh
DATE=$(date +%Y%m%d)
curl -o "rejected-$DATE.csv" \
  "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&format=csv&limit=5000"
```

### 2. Excel Power Query Auto-Refresh
1. Open Excel
2. **Data** → **Get Data** → **From Web**
3. URL: `http://135.181.33.13:3002/api/frontend/loan/records?limit=1000`
4. Click **OK** → **Load**
5. Right-click table → **Refresh** to update

### 3. Power BI Integration
1. **Get Data** → **Web**
2. URL: `http://135.181.33.13:3002/api/frontend/loan/records?limit=5000`
3. **Advanced** → **OK**
4. Transform data as needed

### 4. Automated Weekly Report (Windows Task Scheduler)
```powershell
# Save as: weekly-report.ps1
$date = Get-Date -Format "yyyyMMdd"
$url = "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"
$output = "C:\Reports\loans-$date.csv"
Invoke-WebRequest -Uri $url -OutFile $output

# Email the report (optional)
Send-MailMessage -From "reports@company.com" -To "team@company.com" `
  -Subject "Weekly Loan Report $date" -Attachments $output `
  -SmtpServer "smtp.company.com"
```

## 🔍 Testing

### Test API Availability
```bash
curl -s "http://135.181.33.13:3002/api/frontend/loan/records?limit=1" | head -20
```

### Test CSV Export
```bash
curl -s "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5" | head -3
```

### Expected Output (CSV):
```
applicationNumber,loanNumber,checkNumber,status,amount,purpose,...
ESS1234567890,LN001,CHK001,DISBURSED,500000,Business,...
```

## 📞 Support

### If Dashboard Shows No Data:
1. Check API: `curl http://135.181.33.13:3002/api/frontend/loan/records?limit=1`
2. Verify Infinity datasource is selected in panel settings
3. Check panel query URL matches API endpoint

### If CSV Export Fails:
1. Test API: Add `&format=csv` to URL
2. Check limit parameter (max 5000)
3. Verify status value is correct

### For Grafana Issues:
1. Check logs: `ssh uswege@5.75.185.137 'docker logs grafana --tail 50'`
2. Verify plugin: `docker exec grafana grafana-cli plugins ls`
3. Restart Grafana: `docker restart grafana`

## 📚 Documentation Links

- **Quick Start**: [QUICK_START_EXPORT.md](QUICK_START_EXPORT.md)
- **Full API Docs**: [README_LOAN_RECORDS_EXPORT.md](README_LOAN_RECORDS_EXPORT.md)
- **Metrics Dashboard**: [README_LOAN_TABLES.md](README_LOAN_TABLES.md)

---

## ✅ Summary

**What's Ready:**
- ✅ Infinity plugin installed (v3.6.0)
- ✅ Grafana restarted and running
- ✅ API endpoint deployed and working
- ✅ CSV export functional
- ✅ Dashboard JSON ready to import

**What You Need to Do:**
1. Add Infinity datasource in Grafana UI (2 minutes)
2. Import dashboard JSON (1 minute)
3. Start exporting data!

**No Grafana?** Use direct CSV export:
```bash
curl -o loans.csv "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"
```
