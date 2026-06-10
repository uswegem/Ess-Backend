# Check Number Usage Guide

## Overview
This document explains the correct usage of `essCheckNumber` field in the ESS loan system.

## Important Principle

> **Check Number is UNIQUE PER CLIENT, NOT PER LOAN**
> 
> One client (identified by a check number) can have multiple loan records.
> **NEVER use check number alone for loan lookups.**

## Schema Definition

```javascript
// LoanMapping Model
essCheckNumber: {
  type: String,
  index: true,
  // IMPORTANT: Unique per CLIENT, NOT per loan
  // One client (check number) can have multiple loan records
  // DO NOT use this field alone for loan lookups
}

essLoanNumberAlias: {
  type: String,
  index: true,
  // Unique loan identifier - use this for loan lookups
}

essApplicationNumber: {
  type: String,
  required: true,
  index: true,
  // Unique per loan application
}
```

## Correct Usage Patterns

### ✅ CORRECT: Use for Client Identification
```javascript
// Store client data with both application number (primary) and check number
await LoanMappingService.createOrUpdateWithClientData(
    messageDetails.ApplicationNumber,  // Primary key - unique per loan
    messageDetails.CheckNumber,        // Client identifier - for reference only
    clientData,
    loanData,
    employmentData
);

// Store in metadata for informational purposes
metadata: {
    balanceRequests: [{
        checkNumber: checkNumber,  // OK - for logging/tracking
        // ... other fields
    }]
}
```

### ✅ CORRECT: Use Loan Number or Application Number for Lookups
```javascript
// Strategy 1: Lookup by loan number (best for balance requests)
const loanMapping = await LoanMappingService.getByEssLoanNumberAlias(loanNumber);

// Strategy 2: Lookup by application number (best for offer requests)
const loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber);

// Strategy 3: Lookup by MIFOS loan ID
const loanMapping = await LoanMappingService.getByMifosLoanId(mifosLoanId);
```

### ❌ INCORRECT: Use Check Number Alone for Loan Lookup
```javascript
// NEVER DO THIS - will find wrong loan if client has multiple loans
const loanMapping = await LoanMapping.findOne({ essCheckNumber: checkNumber });

// NEVER DO THIS - ambiguous which loan to return
const loanMapping = await LoanMappingService.getByEssCheckNumber(checkNumber); // Method doesn't exist!
```

## Handler-Specific Patterns

### Balance Request Handlers
In `TOP_UP_PAY_0FF_BALANCE_REQUEST` and `TAKEOVER_PAY_OFF_BALANCE_REQUEST`:

```javascript
// Extract from request
const checkNumber = messageDetails.CheckNumber; // Client identifier (informational)
const loanNumber = messageDetails.LoanNumber;   // Unique loan identifier - USE THIS!

// Lookup using loan number
const loanMapping = await LoanMappingService.getByEssLoanNumberAlias(loanNumber);
```

### Offer Request Handlers
In `TOP_UP_OFFER_REQUEST` and `LOAN_TAKEOVER_OFFER_REQUEST`:

```javascript
// Extract from request
const applicationNumber = messageDetails.ApplicationNumber; // Primary key
const checkNumber = messageDetails.CheckNumber;             // Client reference

// Store with both (application number is the unique key)
await LoanMappingService.createOrUpdateWithClientData(
    applicationNumber,  // Primary - unique per loan
    checkNumber,        // Secondary - for client reference
    clientData,
    loanData,
    employmentData
);
```

## Database Relationships

```
Client (Check Number)
├── Loan 1 (Application Number: ESS001, Loan Number: LOAN001)
├── Loan 2 (Application Number: ESS002, Loan Number: LOAN002)  
└── Loan 3 (Application Number: ESS003, Loan Number: LOAN003)
```

**Same check number, multiple loans!**

## Why This Matters

### Scenario: Client with Multiple Loans
1. Client with check number `CHK12345` has:
   - Active loan: `LOAN001` (outstanding balance: 5,000,000 TZS)
   - Completed loan: `LOAN002` (fully paid)
   - Pending top-up: `LOAN003` (new application)

2. If you lookup by check number alone:
   ```javascript
   // ❌ WRONG - which loan should this return?
   const loan = await LoanMapping.findOne({ essCheckNumber: 'CHK12345' });
   // Could return LOAN001, LOAN002, or LOAN003 - undefined behavior!
   ```

3. If you lookup by loan number:
   ```javascript
   // ✅ CORRECT - returns exact loan requested
   const loan = await LoanMapping.findOne({ essLoanNumberAlias: 'LOAN001' });
   // Always returns LOAN001 - predictable behavior!
   ```

## Files Updated

The following files have been updated with explicit documentation:

1. **[topUpBalanceHandler.js](../src/controllers/handlers/topUpBalanceHandler.js)**
   - Added warning in function documentation
   - Clarified that checkNumber is for client identification only
   - Documented that loanNumber is used for lookups

2. **[takeoverBalanceHandler.js](../src/controllers/handlers/takeoverBalanceHandler.js)**
   - Added warning in function documentation
   - Clarified lookup strategy uses loanNumber

3. **[LoanMapping.js](../src/models/LoanMapping.js)**
   - Added schema field comments
   - Documented that essCheckNumber is NOT unique per loan

## Verification Checklist

When reviewing code, verify:

- [ ] Check number is never used alone in `findOne()` queries
- [ ] Balance requests use `loanNumber` for lookups
- [ ] Offer requests use `applicationNumber` as primary key
- [ ] Check number is stored for reference/logging only
- [ ] LoanMappingService methods use correct unique identifiers

## Summary

| Field | Scope | Usage |
|-------|-------|-------|
| `essCheckNumber` | Client-scoped | ✅ Store for reference<br>✅ Log for tracking<br>❌ NEVER use for loan lookup |
| `essLoanNumberAlias` | Loan-scoped | ✅ Primary identifier for balance requests<br>✅ Unique per loan |
| `essApplicationNumber` | Loan-scoped | ✅ Primary identifier for offer requests<br>✅ Unique per application |
| `mifosLoanId` | Loan-scoped | ✅ Unique identifier in MIFOS<br>✅ Use for CBS operations |

---

**Last Updated**: December 21, 2025  
**Status**: ✅ All handlers verified to use correct lookup patterns
