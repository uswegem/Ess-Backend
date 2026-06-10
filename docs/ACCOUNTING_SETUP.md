# ZeDone Mifos Accounting Setup

## Date: December 19, 2025

## Overview
Successfully configured **ACCRUAL PERIODIC** accounting for the main loan product: **Watumishi Wezesha Loan (WWL)** - Product ID: 17

---

## Chart of Accounts Summary

### Assets (14 accounts)
- **1000** - Assets (Header)
- **1001** - Cash at Bank
- **1002** - Petty Cash
- **1100** - Loans and Advances (Header)
- **1101** - Loans to Customers
- **1102** - Loan Interest Receivable
- **1200** - Fixed Assets (Header)
- **1201** - Property and Equipment
- **1202** - Accumulated Depreciation
- **1300** - Other Assets (Header)
- **1301** - Prepaid Expenses
- **1302** - Deferred Tax Assets
- **1303** - Fees Receivable
- **1304** - Penalties Receivable

### Liabilities (9 accounts)
- **2000** - Liabilities (Header)
- **2100** - Customer Deposits (Header)
- **2101** - Savings Deposits
- **2102** - Time Deposits
- **2200** - Borrowings (Header)
- **2201** - Bank Loans
- **2300** - Other Liabilities (Header)
- **2301** - Accounts Payable
- **2302** - Accrued Expenses

### Equity (5 accounts)
- **3000** - Equity (Header)
- **3100** - Share Capital
- **3200** - Retained Earnings
- **3300** - Reserves (Header)
- **3301** - Statutory Reserves

### Income (7 accounts)
- **4000** - Income (Header)
- **4100** - Interest Income (Header)
- **4101** - Loan Interest Income
- **4102** - Investment Income
- **4200** - Fee Income (Header)
- **4201** - Loan Processing Fees
- **4300** - Other Income

### Expenses (8 accounts)
- **5000** - Expenses (Header)
- **5100** - Interest Expense (Header)
- **5101** - Interest on Borrowings
- **5200** - Operating Expenses (Header)
- **5201** - Salaries and Wages
- **5202** - Rent and Utilities
- **5300** - Depreciation Expense
- **5400** - Provision for Loan Losses

---

## Loan Product Accounting Configuration

### Product: Watumishi Wezesha Loan (ID: 17)
**Accounting Rule:** ACCRUAL PERIODIC

#### Asset Accounts (Debit when increased)
| Account Type | GL Code | Account Name | Usage |
|-------------|---------|--------------|-------|
| **Fund Source** | 1001 | Cash at Bank | Disbursement source |
| **Loan Portfolio** | 1101 | Loans to Customers | Principal outstanding |
| **Interest Receivable** | 1102 | Loan Interest Receivable | Accrued interest |
| **Fees Receivable** | 1303 | Fees Receivable | Accrued fees |
| **Penalties Receivable** | 1304 | Penalties Receivable | Accrued penalties |
| **Transfers in Suspense** | 1300 | Other Assets | Transfers pending |

#### Income Accounts (Credit when increased)
| Account Type | GL Code | Account Name | Usage |
|-------------|---------|--------------|-------|
| **Interest Income** | 4101 | Loan Interest Income | Interest earned |
| **Fee Income** | 4201 | Loan Processing Fees | Fees earned |
| **Penalty Income** | 4300 | Other Income | Penalties earned |
| **Recovery Income** | 4300 | Other Income | Recovered amounts |

#### Expense Accounts (Debit when increased)
| Account Type | GL Code | Account Name | Usage |
|-------------|---------|--------------|-------|
| **Write Off** | 5400 | Provision for Loan Losses | Bad debt expense |

#### Liability Accounts (Credit when increased)
| Account Type | GL Code | Account Name | Usage |
|-------------|---------|--------------|-------|
| **Overpayment Liability** | 2301 | Accounts Payable | Customer overpayments |

---

## Accounting Journal Entries

### 1. Loan Disbursement
```
Dr. Loans to Customers (1101)          1,000,000
    Cr. Cash at Bank (1001)                        1,000,000
```

### 2. Interest Accrual (Monthly)
```
Dr. Loan Interest Receivable (1102)      50,000
    Cr. Loan Interest Income (4101)                 50,000
```

### 3. Loan Repayment Received
```
Dr. Cash at Bank (1001)                  100,000
    Cr. Loans to Customers (1101)                   80,000
    Cr. Loan Interest Receivable (1102)             20,000
```

### 4. Fee Accrual
```
Dr. Fees Receivable (1303)                5,000
    Cr. Loan Processing Fees (4201)                  5,000
```

### 5. Fee Payment Received
```
Dr. Cash at Bank (1001)                   5,000
    Cr. Fees Receivable (1303)                       5,000
```

### 6. Penalty Accrual
```
Dr. Penalties Receivable (1304)           2,000
    Cr. Other Income (4300)                          2,000
```

### 7. Write-Off (Bad Debt)
```
Dr. Provision for Loan Losses (5400)    100,000
    Cr. Loans to Customers (1101)                  100,000
```

### 8. Overpayment by Customer
```
Dr. Cash at Bank (1001)                  105,000
    Cr. Loans to Customers (1101)                  100,000
    Cr. Accounts Payable (2301)                      5,000
```

---

## Configuration Scripts

### Review Accounting
```bash
node review-accounting.js
```

### Setup Accounting (Already Applied)
```bash
node setup-accounting.js
```

---

## Verification

### Product Status After Configuration
- ✅ **Product ID 4** - Watumishi Wezesha Loan with Accounting: ACCRUAL PERIODIC
- ✅ **Product ID 17** - Watumishi Wezesha Loan: **ACCRUAL PERIODIC** (Updated)

### Key Benefits of Accrual Accounting
1. **Real-time P&L**: Income recognized when earned, not when cash received
2. **Accurate Balance Sheet**: Shows true receivables and liabilities
3. **Regulatory Compliance**: Meets financial reporting standards
4. **Better Decision Making**: Clear view of financial health
5. **Automated Journal Entries**: Mifos creates GL entries automatically

### Monitoring
- Check trial balance regularly: `/v1/accounting/glaccounts`
- Review journal entries: `/v1/journalentries`
- Generate financial reports from Mifos UI

---

## Next Steps

1. ✅ Accounting rules configured
2. Test loan lifecycle with accounting enabled
3. Review first loan's journal entries
4. Generate trial balance report
5. Verify balance sheet accuracy
6. Set up periodic closing procedures

---

## Support
- Mifos Tenant: `zedone-uat`
- Server: 135.181.33.13
- API Port: 3002
- Accounting Rule: **3 (ACCRUAL PERIODIC)**
