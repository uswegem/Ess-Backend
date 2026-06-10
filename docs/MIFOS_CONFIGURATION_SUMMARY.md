# ZeDone Mifos Configuration Summary

## Date: December 19, 2025

---

## 1. LOAN PRODUCT CONFIGURATION ✅

### Product Details
- **Product Name**: Watumishi Wezesha Loan
- **Short Name**: WWL
- **Product ID**: 17
- **Currency**: TZS (Tanzanian Shilling)

### Loan Terms
- **Principal Range**: TZS 100,000 - 120,000,000
- **Interest Rate**: 24% per annum
- **Repayment Frequency**: Monthly
- **Number of Repayments**: 6 - 96 months
- **Amortization**: Equal Installments
- **Interest Calculation**: Declining Balance

---

## 2. ACCOUNTING CONFIGURATION ✅

### Accounting Rule: **ACCRUAL PERIODIC**

### Asset Accounts
| Purpose | GL Code | Account Name | Account ID |
|---------|---------|--------------|------------|
| Fund Source | 1001 | Cash at Bank | 6 |
| Loan Portfolio | 1101 | Loans to Customers | 9 |
| Interest Receivable | 1102 | Loan Interest Receivable | 25 |
| Fees Receivable | 1303 | Fees Receivable | 47 |
| Penalties Receivable | 1304 | Penalties Receivable | 48 |
| Transfers in Suspense | 1301 | Prepaid Expenses | 28 |

### Income Accounts
| Purpose | GL Code | Account Name | Account ID |
|---------|---------|--------------|------------|
| Interest Income | 4101 | Loan Interest Income | 38 |
| Fee Income | 4201 | Loan Processing Fees | 40 |
| Penalty Income | 4300 | Other Income | 41 |
| Recovery Income | 4300 | Other Income | 41 |

### Expense Accounts
| Purpose | GL Code | Account Name | Account ID |
|---------|---------|--------------|------------|
| Write Off | 5400 | Provision for Loan Losses | 46 |
| Charge Off | 5400 | Provision for Loan Losses | 46 |

### Liability Accounts
| Purpose | GL Code | Account Name | Account ID |
|---------|---------|--------------|------------|
| Overpayment | 2301 | Accounts Payable | 33 |

---

## 3. DELINQUENCY BUCKET ✅

### Configuration: **Tanzania Microfinance Delinquency**
**Bucket ID**: 1

### Delinquency Ranges (BOT Compliant)
| Classification | Days | BOT Category | Provision % |
|----------------|------|--------------|-------------|
| 1-30 days | 1-30 | Current/Performing | 1% |
| 31-60 days | 31-60 | Watch/Special Mention | 5% |
| 61-90 days | 61-90 | Substandard | 25% |
| 91-120 days | 91-120 | Doubtful | 50% |
| 121-180 days | 121-180 | Loss | 50% |
| 181+ days | 181-9999 | Bad Debt | 100% |

✅ **Status**: Fully configured and aligned with Bank of Tanzania requirements

---

## 4. LOAN LOSS PROVISIONING

### Current Status: ⚠️ **Requires Manual Configuration**

### Recommended Setup (Tanzania BOT Compliant):

1. **Navigate to**: Admin > Organization > Provisioning Criteria
2. **Create New Criteria**: "Tanzania BOT Microfinance Provisioning"
3. **Configure Categories**:

| Category | Min Days | Max Days | Provision % | Liability Account | Expense Account |
|----------|----------|----------|-------------|-------------------|-----------------|
| STANDARD | 0 | 30 | 1% | 2301 (Accounts Payable) | 5400 (Provision for Loan Losses) |
| SUB-STANDARD | 31 | 90 | 25% | 2301 (Accounts Payable) | 5400 (Provision for Loan Losses) |
| DOUBTFUL | 91 | 180 | 50% | 2301 (Accounts Payable) | 5400 (Provision for Loan Losses) |
| LOSS | 181 | 9999 | 100% | 2301 (Accounts Payable) | 5400 (Provision for Loan Losses) |

4. **Assign to Product**: Link criteria to Product ID 17
5. **Run Monthly**: Create provisioning entries at month-end

---

## 5. FINANCIAL REPORTS ✅

### Available Reports (Total: 128)

#### Loan Reports (63 reports)
- ✅ Active Loans - Summary
- ✅ Active Loans - Details
- ✅ Loans Awaiting Disbursal
- ✅ Loans Pending Approval
- ✅ Portfolio at Risk
- ✅ Portfolio at Risk by Branch
- ✅ Written-Off Loans
- ✅ Aging Detail
- ✅ Aging Summary (Arrears in Weeks)
- ✅ Aging Summary (Arrears in Months)
- ✅ Rescheduled Loans
- ✅ Obligation Met Loans
- ✅ Demand Vs Collection
- ✅ Disbursal Vs Awaiting Disbursal
- ✅ Loan Trends by Day/Week/Month

#### Accounting Reports (12 reports)
- ✅ **Trial Balance** (Table & Pentaho)
- ✅ **Income Statement** (Table & Pentaho)
- ✅ **Balance Sheet** (Table & Pentaho)
- ✅ **General Ledger Report** (Table & Pentaho)
- ✅ Trial Balance Summary
- ✅ Transaction Summary

---

## 6. HOW TO ACCESS REPORTS

### Via Mifos UI
1. Login to Mifos at: https://your-mifos-url
2. Navigate to: **Reports > Run Report**
3. Select report category
4. Choose report and set parameters
5. Generate in PDF, Excel, or HTML format

### Via API

#### Trial Balance
```bash
GET /v1/runreports/TrialBalance?R_startDate=2025-01-01&R_endDate=2025-12-31&output-type=pdf&tenantIdentifier=zedone-uat
```

#### Income Statement
```bash
GET /v1/runreports/IncomeStatement?R_startDate=2025-01-01&R_endDate=2025-12-31&output-type=pdf&tenantIdentifier=zedone-uat
```

#### Balance Sheet
```bash
GET /v1/runreports/BalanceSheet?R_date=2025-12-31&output-type=pdf&tenantIdentifier=zedone-uat
```

#### Portfolio at Risk
```bash
GET /v1/runreports/PortfolioatRisk?output-type=pdf&tenantIdentifier=zedone-uat
```

#### Active Loans
```bash
GET /v1/runreports/ActiveLoans-Summary?output-type=pdf&tenantIdentifier=zedone-uat
```

---

## 7. TANZANIA BOT REGULATORY COMPLIANCE

### ✅ Completed Requirements

1. **Chart of Accounts**: Comprehensive 43 accounts across all categories
2. **Accrual Accounting**: Configured for accurate financial reporting
3. **Delinquency Tracking**: 6-tier classification aligned with BOT
4. **Loan Portfolio Monitoring**: Real-time aging and PAR tracking
5. **Financial Reporting**: Complete set of regulatory reports

### ⚠️ Pending Actions

1. **Loan Loss Provisioning**:
   - Configure provisioning criteria through Mifos UI
   - Link criteria to loan product
   - Schedule monthly provisioning runs

2. **User Permissions**:
   - Grant report viewing permissions to relevant users
   - Enable report generation via API if needed

3. **Regular Reporting Schedule**:
   - Daily: Aging reports, cash position
   - Weekly: Portfolio at Risk
   - Monthly: Trial Balance, Income Statement, Balance Sheet, Provisioning
   - Quarterly: BOT regulatory returns

---

## 8. SCRIPTS CREATED

### Configuration Scripts
- `review-accounting.js` - Review chart of accounts
- `setup-accounting.js` - Configure accounting mappings
- `fix-transfer-suspense.js` - Fix transfer suspense account
- `check-loan-product-config.js` - Verify product configuration
- `setup-provisioning.js` - Setup provisioning criteria (UI recommended)
- `setup-reports.js` - List available reports
- `generate-reports.js` - Generate financial reports
- `check-product.js` - Quick product check

### Usage
```bash
cd /home/uswege/ess
node <script-name>.js
```

---

## 9. JOURNAL ENTRY AUTOMATION

With accrual accounting enabled, Mifos automatically creates journal entries for:

### Loan Disbursement
```
Dr. Loans to Customers (1101)
    Cr. Cash at Bank (1001)
```

### Interest Accrual (Monthly)
```
Dr. Loan Interest Receivable (1102)
    Cr. Loan Interest Income (4101)
```

### Loan Repayment
```
Dr. Cash at Bank (1001)
    Cr. Loans to Customers (1101)
    Cr. Loan Interest Receivable (1102)
```

### Fee Collection
```
Dr. Cash at Bank (1001)
    Cr. Loan Processing Fees (4201)
```

### Write-Off
```
Dr. Provision for Loan Losses (5400)
    Cr. Loans to Customers (1101)
    Cr. Loan Interest Receivable (1102)
```

---

## 10. NEXT STEPS

### Immediate Actions
1. ✅ Accounting configuration - COMPLETE
2. ✅ Delinquency bucket - COMPLETE
3. ⚠️ Configure provisioning criteria via Mifos UI
4. ⚠️ Grant report permissions to users
5. ⚠️ Test full loan lifecycle with accounting

### Ongoing Operations
1. Monitor loan portfolio daily
2. Generate aging reports weekly
3. Create provisioning entries monthly
4. Prepare BOT returns quarterly
5. Review financial statements monthly

---

## 11. SUPPORT INFORMATION

- **Mifos Tenant**: zedone-uat
- **Server**: 135.181.33.13
- **API Port**: 3002
- **Accounting Rule**: 3 (ACCRUAL PERIODIC)
- **Loan Product ID**: 17
- **Delinquency Bucket ID**: 1

---

## 12. COMPLIANCE CHECKLIST

- [x] Chart of accounts configured
- [x] Accrual accounting enabled
- [x] Delinquency buckets aligned with BOT
- [x] GL account mappings complete
- [x] Financial reports available
- [ ] Provisioning criteria configured (via UI)
- [ ] User permissions granted
- [ ] Test loans created and verified
- [ ] Monthly reporting schedule established
- [ ] BOT compliance documentation prepared

---

**Configuration Date**: December 19, 2025  
**Configured By**: System Administrator  
**Status**: Production Ready (pending provisioning setup)
