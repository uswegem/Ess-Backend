# 🔧 Grafana Dashboard Import - Step by Step Guide

## Issue Fixed: Datasource Configuration

The dashboard has been updated to properly prompt for datasource selection during import.

---

## 📋 Step-by-Step Import Instructions

### Step 1: Configure Infinity Data Source (One Time Setup)

1. **Open Grafana**: http://5.75.185.137:3000/
2. **Login**: admin / admin
3. **Navigate to**: ☰ Menu → **Connections** → **Data sources**
4. **Click**: **Add data source**
5. **Search**: Type "infinity" in search box
6. **Select**: Click on **Infinity**
7. **Configure**:
   - **Name**: `Infinity` (or any name you prefer)
   - **URL**: Leave blank (not needed for REST APIs)
   - **Auth**: None
8. **Click**: **Save & Test**
9. **Verify**: Should show green checkmark "Data source is working"

### Step 2: Import Dashboard (Using Fixed JSON)

#### Option A: Re-import from File (Recommended)

1. **Download the latest dashboard**: 
   - File: `monitoring/grafana-dashboard-loan-records-tables.json`
   - Or download from: http://135.181.33.13:3002/ (if you have file access)

2. **In Grafana**:
   - Click ☰ → **Dashboards**
   - Click **New** → **Import**
   - Click **Upload JSON file**
   - Select: `grafana-dashboard-loan-records-tables.json`

3. **Configure Import**:
   - **Infinity**: Select your Infinity datasource from dropdown
   - **Name**: Keep as "ESS Loan Records - Individual Records (Exportable)"
   - **Folder**: Choose or create "ESS Monitoring"
   - **UID**: Keep as `ess-loan-records-export` or change if needed

4. **Click**: **Import**

#### Option B: Manual Panel Creation (If import still fails)

If the import continues to have issues, create panels manually:

1. **Create New Dashboard**:
   - Click ☰ → **Dashboards** → **New Dashboard**
   - Click **Add visualization**
   - Select **Infinity** datasource

2. **Configure First Panel (All Loans)**:
   - **Query**:
     - **Type**: JSON
     - **Parser**: Backend
     - **Source**: URL
     - **Method**: GET
     - **URL**: `http://135.181.33.13:3002/api/frontend/loan/records?limit=1000`
     - **Format**: Table
     - **Root/Rows**: `data`
   
   - **Panel Settings**:
     - **Title**: "All Loan Records"
     - **Visualization**: Table
   
   - Click **Apply**

3. **Add More Panels** (Repeat for each status):
   - **REJECTED Loans**: URL = `...?status=REJECTED&limit=500`
   - **DISBURSED Loans**: URL = `...?status=DISBURSED&limit=500`
   - **INITIAL_OFFER Loans**: URL = `...?status=INITIAL_OFFER&limit=500`
   - etc.

---

## 🧪 Test API Directly First

Before importing dashboard, verify the API is accessible:

### Test from command line:
```bash
# Test JSON response
curl http://135.181.33.13:3002/api/frontend/loan/records?limit=2

# Expected: {"success":true,"data":[...],"pagination":{...}}
```

### Test from Grafana server (important!):
```bash
# SSH to Grafana server
ssh uswege@5.75.185.137

# Test if Grafana can reach the API
docker exec grafana curl -s http://135.181.33.13:3002/api/frontend/loan/records?limit=1

# Should return JSON data
```

**If this fails**, the issue is network connectivity between Grafana and the API server.

---

## 🔍 Troubleshooting PanelQueryRunner Errors

### Error: "Failed to load resource: 404"

**Cause**: Dashboard UID not found or datasource not configured

**Solution**:
1. Delete old dashboard if exists:
   - Go to dashboard → Settings (gear icon) → **Delete**
2. Re-import using the fixed JSON file
3. Ensure Infinity datasource is selected during import

### Error: "PanelQueryRunner Error"

**Cause**: Query configuration issue or API not reachable

**Solution**:
1. **Check API is running**:
   ```bash
   curl http://135.181.33.13:3002/api/frontend/loan/records?limit=1
   ```

2. **Check from Grafana container**:
   ```bash
   ssh uswege@5.75.185.137 'docker exec grafana curl -s http://135.181.33.13:3002/api/frontend/loan/records?limit=1'
   ```

3. **Verify panel query**:
   - Click panel → Edit
   - Check **Query** tab
   - Verify URL is correct
   - Check **Root/Rows** is set to `data`
   - Try running query with **Run queries** button

### Error: CORS or Network Issues

**If Grafana can't reach the API**:

```bash
# On ESS application server, check if port 3002 is accessible
ssh uswege@135.181.33.13 'netstat -tlnp | grep 3002'

# Should show: tcp6       0      0 :::3002
```

**Fix firewall if needed**:
```bash
# Allow port 3002 (if firewall is blocking)
ssh uswege@135.181.33.13 'sudo ufw allow 3002/tcp'
```

---

## 📊 Alternative: Use CSV Export (No Grafana Dashboard Needed)

If dashboard import continues to have issues, you can still get all data via direct API:

### Download Complete Dataset
```bash
# All loans
curl -o loans.csv "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"

# By status
curl -o rejected.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=REJECTED&format=csv"
curl -o disbursed.csv "http://135.181.33.13:3002/api/frontend/loan/records?status=DISBURSED&format=csv"
```

### Windows PowerShell
```powershell
# Download and open in Excel
$url = "http://135.181.33.13:3002/api/frontend/loan/records?format=csv&limit=5000"
$file = "$env:USERPROFILE\Downloads\loans.csv"
Invoke-WebRequest -Uri $url -OutFile $file
Start-Process excel $file
```

### Connect Excel to API (Auto-Refresh)
1. Open Excel
2. **Data** → **Get Data** → **From Web**
3. URL: `http://135.181.33.13:3002/api/frontend/loan/records?limit=1000`
4. Click **OK** → **Load**
5. Right-click table → **Refresh** to update anytime

---

## ✅ Verification Checklist

Before troubleshooting, verify:

- [ ] Infinity plugin installed: `docker exec grafana grafana-cli plugins ls | grep infinity`
- [ ] Grafana restarted after plugin install
- [ ] Infinity datasource configured in Grafana UI
- [ ] API endpoint accessible: `curl http://135.181.33.13:3002/api/frontend/loan/records?limit=1`
- [ ] API accessible from Grafana: `docker exec grafana curl http://135.181.33.13:3002/api/frontend/loan/records?limit=1`
- [ ] Latest dashboard JSON downloaded

---

## 📞 Quick Fixes

### Fix 1: Delete and Re-import Dashboard
```
1. Go to dashboard
2. Click ⚙️ (Settings) → Delete dashboard
3. Re-import using latest JSON
4. Select Infinity datasource when prompted
```

### Fix 2: Reset Grafana Plugin
```bash
ssh uswege@5.75.185.137
docker exec grafana grafana-cli plugins uninstall yesoreyeram-infinity-datasource
docker exec grafana grafana-cli plugins install yesoreyeram-infinity-datasource
docker restart grafana
```

### Fix 3: Use Simple Test Panel
```
1. Create new dashboard
2. Add panel
3. Select Infinity datasource
4. Query type: JSON
5. URL: http://135.181.33.13:3002/api/frontend/loan/records?limit=5
6. Root: data
7. Format: Table
8. Apply
```

If this works, the issue was with the imported dashboard JSON.

---

## 📚 Documentation

- **This Guide**: Troubleshooting dashboard import
- **Setup Complete**: [GRAFANA_SETUP_COMPLETE.md](GRAFANA_SETUP_COMPLETE.md)
- **API Documentation**: [README_LOAN_RECORDS_EXPORT.md](README_LOAN_RECORDS_EXPORT.md)
- **Quick Start**: [QUICK_START_EXPORT.md](QUICK_START_EXPORT.md)

---

## 🎯 Summary

**The dashboard JSON has been fixed** with proper datasource template variables.

**Next steps**:
1. Re-download the dashboard JSON (it's been updated)
2. Delete old dashboard if it exists
3. Import the new version
4. Select your Infinity datasource when prompted

**Alternative**: Use direct CSV export if Grafana dashboard isn't critical for your workflow.
