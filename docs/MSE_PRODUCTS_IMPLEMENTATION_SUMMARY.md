# MSE Loan Products - Implementation Summary

**Document Version:** 1.0  
**Date:** December 30, 2025  
**Prepared For:** Credit Connect UAT  
**Prepared By:** MiraCore Development Team

---

## Executive Summary

Three new MSE (Micro, Small & Medium Enterprise) loan products have been successfully configured in the Credit Connect UAT environment. These products are designed to provide short-term financing solutions for businesses with flexible terms and competitive rates.

---

## Product Overview

| Feature | MPOF | MIDF | MWCF |
|---------|------|------|------|
| **Full Name** | MSE Purchase Order Finance | MSE Invoice Discounting Finance | MSE Working Capital Finance |
| **Product ID** | 18 | 19 | 20 |
| **Short Name** | MPOF | MIDF | MWCF |
| **Purpose** | Short-term funding to fulfil purchase orders before receiving payment | Advance against unpaid customer invoices to improve cash flow | General working capital needs for business operations |
| **Principal Range** | BWP 5,000 - 1,000,000 | BWP 5,000 - 1,000,000 | BWP 5,000 - 1,000,000 |
| **Default Principal** | BWP 50,000 | BWP 50,000 | BWP 50,000 |
| **Interest Rate** | 7% per month (84% p.a.) | 7% per month (84% p.a.) | 7% per month (84% p.a.) |
| **Tenor** | 1-4 months | 1-4 months | 1-4 months |
| **Repayment Frequency** | Monthly | Monthly | Monthly |

---

## Product Descriptions

### 1. MSE Purchase Order Finance (MPOF)
Short-term funding to help businesses fulfil purchase orders before receiving payment. This product provides value upfront to procure products, making it ideal for short-term liquidity needs with fixed revenue expected from delivered products.

### 2. MSE Invoice Discounting Finance (MIDF)
An advance provided against unpaid customer invoices. A portion of the invoice value is provided upfront to improve business cash flow. The lender receives a fee and settles the invoice upon customer payment.

### 3. MSE Working Capital Finance (MWCF)
General working capital financing to support day-to-day business operations, covering expenses such as inventory, payroll, and operational costs.

---

## Fee Structure (All Products)

| Fee Type | Rate | Application | Capitalized |
|----------|------|-------------|-------------|
| Arrangement Fee | 1% of loan amount | At disbursement | Yes |
| MSE Insurance Fee | 0.254% of loan amount | At disbursement | No |

---

## Key Configuration Details

| Setting | Value |
|---------|-------|
| **Currency** | BWP (Botswana Pula) |
| **Interest Type** | Flat Rate |
| **Amortization** | Equal Installments |
| **Interest Calculation Period** | Same as Repayment Period |
| **Days in Month** | 30 days |
| **Days in Year** | 360 days |
| **Transaction Strategy** | Penalties, Fees, Interest, Principal order |
| **Grace Period on Principal** | 1 month |
| **NPA Days** | 90 days |
| **Accounting Rule** | Accrual Periodic |

---

## Delinquency Classification (Provisions)

| Classification | Days Overdue | Provisioning Implication |
|----------------|--------------|--------------------------|
| Special Mention | 1-30 days | Early warning |
| Substandard | 31-60 days | Increased monitoring |
| Doubtful | 61-90 days | High risk of default |
| Loss | 91+ days | Write-off consideration |

---

## Loan Lifecycle Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MSE LOAN PROCESS FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐
   │   CLIENT     │
   │  APPLICATION │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐     ┌─────────────────────────────────────────────┐
   │   LOAN       │     │  Required Information:                      │
   │  SUBMISSION  │────▶│  • Principal amount                         │
   │              │     │  • Loan tenor (1-4 months)                  │
   │  Status: 100 │     │  • Collateral details (if applicable)       │
   └──────┬───────┘     │  • Purpose of loan                          │
          │             └─────────────────────────────────────────────┘
          ▼
   ┌──────────────┐     ┌─────────────────────────────────────────────┐
   │   VETTING    │     │  Client Verification Details (KYC):         │
   │   APPROVAL   │────▶│  • Employment Status & Employer Name        │
   │              │     │  • Retirement Date                          │
   │              │     │  • ID Type & Expiry Date                    │
   │              │     │  • Bank Account, Code & Branch              │
   │              │     │  • National ID (Omang)                      │
   │              │     │  • AML Risk Rating                          │
   │              │     │  • Politically Exposed Person Status        │
   └──────┬───────┘     └─────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────┐     ┌─────────────────────────────────────────────┐
   │    LOAN      │     │  Automatic Actions on Approval:             │
   │   APPROVED   │────▶│  ✓ Webhook triggers PDF generation          │
   │              │     │  ✓ Facility Letter generated                │
   │  Status: 200 │     │  ✓ Loan Agreement generated                 │
   └──────┬───────┘     │  ✓ Documents attached to loan               │
          │             └─────────────────────────────────────────────┘
          ▼
   ┌──────────────┐     ┌─────────────────────────────────────────────┐
   │ DISBURSEMENT │     │  Fees Deducted:                             │
   │              │────▶│  • Arrangement Fee (1%)                     │
   │  Status: 300 │     │  • MSE Insurance Fee (0.254%)               │
   │   (Active)   │     │  Net Disbursement = Principal - Fees        │
   └──────┬───────┘     └─────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────┐
   │  REPAYMENT   │     Monthly installments until maturity
   │    PHASE     │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │    LOAN      │
   │   CLOSED     │
   │  Status: 500 │
   └──────────────┘
```

---

## Automatic Document Generation

Upon loan approval, the system automatically generates the following documents:

| Document | Description | Format |
|----------|-------------|--------|
| **Facility Letter** | Formal offer letter outlining loan terms, conditions, and repayment schedule | PDF |
| **Loan Agreement** | Legal contract between the lender and borrower | PDF |

### Technical Implementation
- **Trigger:** Webhook configured on LOAN.APPROVE event
- **Technology:** PDF generation service using pdf-lib library
- **Storage:** Documents automatically attached to loan record in MIFOS
- **Access:** Available via Documents tab in Client/Loan view

---

## GL Account Mapping (Accounting)

| Transaction Type | Account Description |
|------------------|---------------------|
| Fund Source | Clearing Account |
| Loan Portfolio | Loans Receivable |
| Interest Receivable | Interest Receivable Account |
| Interest Income | Interest Income Account |
| Fees Receivable | Fees Receivable Account |
| Fees Income | Fee Income Account |
| Losses Written Off | Bad Debt Expense |
| Overpayment Liability | Overpayment Liability Account |

---

## Sample Loan Calculations

### Example 1: MPOF - BWP 50,000 for 2 months

| Component | Calculation | Amount (BWP) |
|-----------|-------------|--------------|
| Principal | - | 50,000.00 |
| Interest (7% × 2 months) | 50,000 × 7% × 2 | 7,000.00 |
| Arrangement Fee (1%) | 50,000 × 1% | 500.00 |
| MSE Insurance Fee (0.254%) | 50,000 × 0.254% | 127.00 |
| **Total Repayable** | Principal + Interest | **57,000.00** |
| **Net Disbursement** | Principal - Fees | **49,373.00** |
| **Monthly Installment** | Total ÷ 2 | **28,500.00** |

### Example 2: MIDF - BWP 75,000 for 3 months

| Component | Calculation | Amount (BWP) |
|-----------|-------------|--------------|
| Principal | - | 75,000.00 |
| Interest (7% × 3 months) | 75,000 × 7% × 3 | 15,750.00 |
| Arrangement Fee (1%) | 75,000 × 1% | 750.00 |
| MSE Insurance Fee (0.254%) | 75,000 × 0.254% | 190.50 |
| **Total Repayable** | Principal + Interest | **90,750.00** |
| **Net Disbursement** | Principal - Fees | **74,059.50** |
| **Monthly Installment** | Total ÷ 3 | **30,250.00** |

### Example 3: MWCF - BWP 100,000 for 4 months

| Component | Calculation | Amount (BWP) |
|-----------|-------------|--------------|
| Principal | - | 100,000.00 |
| Interest (7% × 4 months) | 100,000 × 7% × 4 | 28,000.00 |
| Arrangement Fee (1%) | 100,000 × 1% | 1,000.00 |
| MSE Insurance Fee (0.254%) | 100,000 × 0.254% | 254.00 |
| **Total Repayable** | Principal + Interest | **128,000.00** |
| **Net Disbursement** | Principal - Fees | **98,746.00** |
| **Monthly Installment** | Total ÷ 4 | **32,000.00** |

---

## Test Loans Created

| Loan ID | Account No | Client | Product | Principal (BWP) | Tenor | Status |
|---------|------------|--------|---------|-----------------|-------|--------|
| 68 | 000000068 | Patrick Ika Lekone | MPOF | 50,000 | 2 months | Pending Approval |
| 69 | 000000069 | Miriam Lusekelo Kikuli | MIDF | 75,000 | 3 months | Pending Approval |
| 70 | 000000070 | Jothan Uswege Mwaipyana | MWCF | 100,000 | 4 months | Pending Approval |

---

## System Integration

| Component | Details |
|-----------|---------|
| **Core Banking System** | Apache Fineract (MIFOS X) |
| **Tenant** | creditconnect-uat |
| **Environment URL** | https://creditconnect-uat.miracore.co.tz |
| **Middleware** | ESS Node.js Application |
| **Middleware Port** | 3002 |
| **Webhook URL** | http://135.181.33.13:3002/api/webhook/mifos/ |
| **Events Monitored** | LOAN.APPROVE, LOAN.DISBURSE |

---

## UAT Checklist

| # | Task | Status |
|---|------|--------|
| 1 | Product configuration complete | ✅ Complete |
| 2 | GL account mappings configured | ✅ Complete |
| 3 | Delinquency buckets assigned | ✅ Complete |
| 4 | Charges (fees) attached | ✅ Complete |
| 5 | Webhook for PDF generation configured | ✅ Complete |
| 6 | Test loans created | ✅ Complete |
| 7 | Complete vetting approval for test loans | ⏳ Pending |
| 8 | Verify PDF document generation | ⏳ Pending |
| 9 | Test full disbursement cycle | ⏳ Pending |
| 10 | Verify repayment processing | ⏳ Pending |
| 11 | Test delinquency classification | ⏳ Pending |
| 12 | UAT sign-off | ⏳ Pending |
| 13 | Production deployment | ⏳ Pending |

---

## Appendix A: Loan Status Codes

| Status Code | Status Name | Description |
|-------------|-------------|-------------|
| 100 | Submitted and Pending Approval | Loan application submitted, awaiting approval |
| 200 | Approved | Loan approved, awaiting disbursement |
| 300 | Active | Loan disbursed and in repayment phase |
| 400 | Withdrawn | Loan application withdrawn by client |
| 500 | Closed - Obligations Met | Loan fully repaid |
| 600 | Closed - Written Off | Loan written off as bad debt |
| 700 | Closed - Rescheduled | Loan closed due to rescheduling |

---

## Appendix B: Contact Information

For technical support or queries regarding these products, please contact:

- **Technical Team:** MiraCore Development
- **System:** Credit Connect UAT
- **Server:** 135.181.33.13

---

*Document End*
