# Quick Start: Export Loan Records to CSV/Excel

## ✅ What's Deployed

You now have **3 ways** to access individual loan records:

### 1. Direct CSV Download (No Grafana needed)
```bash
# Download all loans as CSV
curl -o loans.csv "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"

# Download by status
curl -o rejected.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&format=csv"
curl -o disbursed.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=DISBURSED&format=csv"
```

### 2. JSON API for Analysis Tools
```bash
# Get JSON data for Power BI, Tableau, etc.
curl "http://135.181.33.13:3002/api/frontend/loan/records?limit=1000"
```

### 3. Grafana Tables (requires Infinity plugin)
- See [README_LOAN_RECORDS_EXPORT.md](README_LOAN_RECORDS_EXPORT.md) for setup

## 🎯 Common Use Cases

### Daily Report of Rejected Loans
```bash
# Save as: daily-rejected-report.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
curl -o "rejected-loans-$DATE.csv" \
  "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&format=csv&limit=5000"
```

### Export All Loans to Excel
1. **Method A: Direct Download**
   ```bash
   curl -o all-loans.csv "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"
   # Open all-loans.csv in Excel
   ```

2. **Method B: Power Query in Excel**
   - Open Excel → Data → Get Data → From Web
   - URL: `http://135.181.33.13:3002/api/frontend/loan/records?limit=5000`
   - Click OK → Load
   - Excel will refresh data automatically

### Filter by Multiple Criteria
```bash
# Get rejected loans (first 500)
curl "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&limit=500&format=csv"

# Get next 500 (pagination)
curl "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&limit=500&offset=500&format=csv"
```

## 📊 Available Fields in Export

Each record includes:
- `applicationNumber` - ESS application number
- `loanNumber` - ESS loan number
- `checkNumber` - Check reference
- `status` - Current status
- `amount` - Loan amount
- `purpose` - Loan purpose
- `employerName` - Employer name
- `employeeNIN` - Employee NIN
- `employeeName` - Employee full name
- `employeeMobile` - Employee phone
- `mifosClientId` - MIFOS client ID
- `mifosLoanId` - MIFOS loan ID
- `rejectedBy` - Who rejected (if applicable)
- `rejectionReason` - Why rejected
- `cancelledBy` - Who cancelled (if applicable)
- `cancellationReason` - Why cancelled
- `failureReason` - System failure reason
- `createdAt` - When created
- `updatedAt` - Last updated
- `disbursementDate` - When disbursed

## 🔍 Status Filters

Available status values:
- `INITIAL_OFFER`
- `OFFER_SUBMITTED`
- `DISBURSED`
- `REJECTED`
- `CANCELLED`
- `FAILED`
- `APPROVED`
- `CLIENT_CREATED`
- `LOAN_CREATED`
- `COMPLETED`

## 📱 Windows Users (PowerShell)

```powershell
# Download to Downloads folder
Invoke-WebRequest -Uri "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000" -OutFile "$env:USERPROFILE\Downloads\loans.csv"

# Open in Excel automatically
$file = "$env:USERPROFILE\Downloads\loans.csv"
Invoke-WebRequest -Uri "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000" -OutFile $file
Start-Process excel $file
```

## 🌐 Google Sheets Auto-Sync (Optional)

See [README_LOAN_RECORDS_EXPORT.md](README_LOAN_RECORDS_EXPORT.md#option-3-google-sheets-integration-advanced) for Apps Script setup.

## 📞 Quick Test

```bash
# Check if API is working
curl "http://135.181.33.13:3002/api/frontend/loan/records?limit=1"

# Should return JSON with loan data or empty array if no loans yet
```

## 🎓 Next Steps

1. **For Grafana Tables**: Install Infinity plugin (see [README_LOAN_RECORDS_EXPORT.md](README_LOAN_RECORDS_EXPORT.md))
2. **For Automated Reports**: Set up cron job or Windows Task Scheduler
3. **For BI Tools**: Use API URL in Power BI/Tableau data connectors

---

**Documentation:**
- Full API docs: [README_LOAN_RECORDS_EXPORT.md](README_LOAN_RECORDS_EXPORT.md)
- Metrics dashboard: [README_LOAN_TABLES.md](README_LOAN_TABLES.md)
