# Loan Mapping Schema - Complete Field Reference

## Table: `loanmappings` (MongoDB Collection)

---

## **ESS IDENTIFIERS**

### 1. `essApplicationNumber` (String, Required, Indexed)
**Description:** Unique application number from ESS system  
**When Updated:**
- ✅ **LOAN_OFFER_REQUEST** - Set when storing client data via `createOrUpdateWithClientData()`
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION** - Used to find existing mapping

**Example:** `ESS1765974145523`

---

### 2. `essCheckNumber` (String, Indexed)
**Description:** Employee check number from ESS  
**When Updated:**
- ✅ **LOAN_OFFER_REQUEST** - Set when storing client data via `createOrUpdateWithClientData()`

**Example:** `CHK1765974145523`

---

### 3. `essLoanNumberAlias` (String, Indexed)
**Description:** FSP-generated loan number sent back to ESS  
**When Updated:**
- ✅ **LOAN_INITIAL_APPROVAL_NOTIFICATION** - Generated via `createInitialMapping()` using `generateLoanNumber()`
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION** - Confirmed/updated with ESS loan number

**Example:** `LOAN1765963593440577`  
**Format:** `LOAN + timestamp`

---

## **FSP IDENTIFIERS**

### 4. `fspReferenceNumber` (String, Optional, Indexed)
**Description:** FSP internal reference number  
**When Updated:**
- ✅ **LOAN_INITIAL_APPROVAL_NOTIFICATION** - Set via `createInitialMapping()` when sending initial approval
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION** - May be updated from ESS response

**Example:** `11915366`

---

## **MIFOS IDENTIFIERS**

### 5. `mifosClientId` (Number, Indexed)
**Description:** Client ID in MIFOS CBS system  
**When Updated:**
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION (APPROVED)** - Set when client is created in MIFOS
  - Location: `apiController.js:1200+` - After successful client creation
  - Method: `ClientService.createClient()` or found via `searchClientByExternalId()`

**Example:** `12345`

---

### 6. `mifosLoanId` (Number, Indexed)
**Description:** Loan account ID in MIFOS CBS system  
**When Updated:**
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION (APPROVED)** - Set when loan is created in MIFOS
  - Location: `apiController.js:1220+` - After successful loan creation
  - Method: `api.post('/v1/loans', loanPayload)`

**Example:** `67890`

---

### 7. `mifosLoanAccountNumber` (String, Indexed)
**Description:** Loan account number in MIFOS  
**When Updated:**
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION (APPROVED)** - Set during loan creation
- ✅ **Manual Update** - Via `updateWithLoanCreation()` method

**Example:** `000000001`

---

## **LOAN DETAILS**

### 8. `productCode` (String, Required)
**Description:** Loan product code  
**When Updated:**
- ✅ **LOAN_OFFER_REQUEST** - Set from request or defaults to "17"
- ✅ **LOAN_INITIAL_APPROVAL_NOTIFICATION** - May be updated

**Default:** `"17"` (ESS Loan Product)

---

### 9. `requestedAmount` (Number, Required)
**Description:** Loan amount requested by employee  
**When Updated:**
- ✅ **LOAN_OFFER_REQUEST** - Set from calculated loan offer amount
- ✅ **LOAN_INITIAL_APPROVAL_NOTIFICATION** - Updated with approved amount
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION** - May be adjusted

**Example:** `5000000` (5 million TZS)

---

### 10. `tenure` (Number, Required)
**Description:** Loan repayment period in months  
**When Updated:**
- ✅ **LOAN_OFFER_REQUEST** - Set from request or defaults to max tenure
- ✅ **LOAN_INITIAL_APPROVAL_NOTIFICATION** - Updated with approved tenure

**Example:** `60` (60 months = 5 years)  
**Default:** `24` months

---

## **STATUS TRACKING**

### 11. `status` (String, Enum)
**Description:** Current loan application status  
**Possible Values:**
- `INITIAL_OFFER` - Initial loan offer created
- `OFFER_SUBMITTED` - Offer submitted to ESS
- `INITIAL_APPROVAL_SENT` - Initial approval notification sent
- `APPROVED` - Internally approved by system
- `FINAL_APPROVAL_RECEIVED` - ESS final approval received
- `CLIENT_CREATED` - MIFOS client created
- `LOAN_CREATED` - MIFOS loan created
- `DISBURSED` - Loan disbursed
- `REJECTED` - Application rejected
- `CANCELLED` - Application cancelled
- `FAILED` - Processing failed

**When Updated:**

| **Message Type** | **Status** | **Location** |
|------------------|-----------|--------------|
| LOAN_OFFER_REQUEST | `OFFER_SUBMITTED` | `loanOfferHandler.js:29` → `createOrUpdateWithClientData()` |
| LOAN_INITIAL_APPROVAL_NOTIFICATION sent | `INITIAL_APPROVAL_SENT` | `createInitialMapping()` |
| LOAN_FINAL_APPROVAL (APPROVED) | `FINAL_APPROVAL_RECEIVED` | `apiController.js:1103` |
| Client created in MIFOS | `CLIENT_CREATED` | `updateWithClientCreation()` |
| Loan created in MIFOS | `LOAN_CREATED` | `updateWithLoanCreation()` |
| Loan disbursed | `DISBURSED` | `apiController.js:1315` or `updateWithDisbursement()` |
| LOAN_FINAL_APPROVAL (REJECTED) | `REJECTED` | `apiController.js:1103` |
| LOAN_CANCELLATION_NOTIFICATION | `CANCELLED` | `apiController.js:987` |

---

## **TIMESTAMPS**

### 12. `initialOfferSentAt` (Date)
**Description:** When initial offer was sent  
**When Updated:**
- ✅ **LOAN_OFFER_REQUEST** - Auto-set to current date
- **Default:** `Date.now()`

---

### 13. `finalApprovalReceivedAt` (Date)
**Description:** When final approval was received from ESS  
**When Updated:**
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION** - Set to current date when status = FINAL_APPROVAL_RECEIVED

**Location:** `loanMappingService.js:178` → `updateWithFinalApproval()`

---

### 14. `clientCreatedAt` (Date)
**Description:** When MIFOS client was created  
**When Updated:**
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION (APPROVED)** - After successful `ClientService.createClient()`

**Location:** `loanMappingService.js:198` → `updateWithClientCreation()`

---

### 15. `loanCreatedAt` (Date)
**Description:** When MIFOS loan was created  
**When Updated:**
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION (APPROVED)** - After successful loan creation in MIFOS

**Location:** `loanMappingService.js:227` → `updateWithLoanCreation()`

---

### 16. `disbursedAt` (Date)
**Description:** When loan was disbursed  
**When Updated:**
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION (APPROVED)** - After loan disbursement in MIFOS
- ✅ **Manual Disbursement** - When status updated to DISBURSED

**Location:** `apiController.js:1315` or `loanMappingService.js:252` → `updateWithDisbursement()`

---

## **ERROR TRACKING**

### 17. `errorLogs` (Array of Objects)
**Description:** Array of error records during processing  
**Structure:**
```javascript
{
  stage: String,      // Which stage the error occurred
  error: String,      // Error message
  timestamp: Date     // When error occurred
}
```

**When Updated:**
- ✅ **Any Error During Processing** - Via `addError()` method
- ✅ **MIFOS API Failures** - Client creation errors, loan creation errors
- ✅ **Validation Errors** - Missing data, invalid formats

**Method:** `loanMapping.addError('CLIENT_CREATION', error)`

---

## **METADATA**

### 18. `metadata` (Mixed/Object)
**Description:** Flexible field for storing additional data  
**When Updated:**
- ✅ **LOAN_OFFER_REQUEST** - Stores complete client, loan, and employment data
- ✅ **LOAN_FINAL_APPROVAL_NOTIFICATION** - Stores final approval details
- ✅ **Throughout Processing** - Updated with various contextual data

**Typical Structure:**
```javascript
{
  clientData: {
    firstName: "John",
    lastName: "Doe",
    nin: "1234567890",
    mobileNumber: "255712345678",
    sex: "M",
    dateOfBirth: "1990-01-01",
    // ... more client fields
  },
  loanData: {
    requestedAmount: 5000000,
    tenure: 60,
    interestRate: 28,
    // ... more loan fields
  },
  employmentData: {
    designationCode: "D001",
    basicSalary: 1500000,
    netSalary: 1200000,
    // ... more employment fields
  },
  finalApprovalDetails: {
    applicationNumber: "ESS1765974145523",
    approval: "APPROVED",
    reason: "Approved by employer"
  },
  disbursementDetails: {
    amount: 5000000,
    date: "2025-12-17T14:30:00.000Z"
  }
}
```

---

## **SYSTEM TIMESTAMPS**

### 19. `createdAt` (Date, Auto-generated)
**Description:** MongoDB automatic timestamp - when document was created  
**When Updated:**
- ✅ **First Insert** - Automatically set by Mongoose
- **Never modified**

---

### 20. `updatedAt` (Date, Auto-generated)
**Description:** MongoDB automatic timestamp - when document was last updated  
**When Updated:**
- ✅ **Every Update** - Automatically updated by Mongoose on any document modification

---

## **COMPLETE LIFECYCLE EXAMPLE**

### **Application: ESS1765974145523**

```
Timeline of Updates:

1. LOAN_OFFER_REQUEST received (2025-12-17 11:40:53)
   ├─ essApplicationNumber = "ESS1765974145523"
   ├─ essCheckNumber = "CHK123456"
   ├─ status = "OFFER_SUBMITTED"
   ├─ productCode = "17"
   ├─ requestedAmount = 5000000
   ├─ tenure = 60
   ├─ initialOfferSentAt = 2025-12-17 11:40:53
   ├─ metadata.clientData = {...}
   ├─ metadata.loanData = {...}
   ├─ metadata.employmentData = {...}
   └─ createdAt = 2025-12-17 11:40:53

2. LOAN_INITIAL_APPROVAL_NOTIFICATION sent (2025-12-17 11:41:10)
   ├─ essLoanNumberAlias = "LOAN1765963593440577"
   ├─ fspReferenceNumber = "11915366"
   ├─ status = "INITIAL_APPROVAL_SENT"
   └─ updatedAt = 2025-12-17 11:41:10

3. LOAN_FINAL_APPROVAL_NOTIFICATION received (2025-12-17 11:55:29)
   ├─ status = "FINAL_APPROVAL_RECEIVED"
   ├─ finalApprovalReceivedAt = 2025-12-17 11:55:29
   ├─ metadata.finalApprovalDetails = {...}
   └─ updatedAt = 2025-12-17 11:55:29

4. MIFOS Client Created (2025-12-17 11:55:35)
   ├─ mifosClientId = 12345
   ├─ status = "CLIENT_CREATED"
   ├─ clientCreatedAt = 2025-12-17 11:55:35
   └─ updatedAt = 2025-12-17 11:55:35

5. MIFOS Loan Created (2025-12-17 11:55:42)
   ├─ mifosLoanId = 67890
   ├─ mifosLoanAccountNumber = "000000001"
   ├─ status = "LOAN_CREATED"
   ├─ loanCreatedAt = 2025-12-17 11:55:42
   └─ updatedAt = 2025-12-17 11:55:42

6. Loan Disbursed (2025-12-17 11:55:50)
   ├─ status = "DISBURSED"
   ├─ disbursedAt = 2025-12-17 11:55:50
   ├─ metadata.disbursementDetails = {...}
   └─ updatedAt = 2025-12-17 11:55:50
```

---

## **KEY SERVICE METHODS & UPDATES**

### `createOrUpdateWithClientData()`
**File:** `loanMappingService.js:29`  
**Updates:**
- essApplicationNumber
- essCheckNumber
- productCode
- requestedAmount
- tenure
- status → "OFFER_SUBMITTED"
- metadata.clientData
- metadata.loanData
- metadata.employmentData

---

### `createInitialMapping()`
**File:** `loanMappingService.js:105`  
**Updates:**
- essLoanNumberAlias
- fspReferenceNumber
- status → "INITIAL_APPROVAL_SENT"
- All fields from loanDetails parameter

---

### `updateWithFinalApproval()`
**File:** `loanMappingService.js:153`  
**Updates:**
- essLoanNumberAlias (confirmed)
- status → "FINAL_APPROVAL_RECEIVED"
- finalApprovalReceivedAt
- metadata.finalApprovalDetails

---

### `updateWithClientCreation()`
**File:** `loanMappingService.js:188`  
**Updates:**
- mifosClientId
- status → "CLIENT_CREATED"
- clientCreatedAt

---

### `updateWithLoanCreation()`
**File:** `loanMappingService.js:219`  
**Updates:**
- mifosLoanId
- mifosLoanAccountNumber
- status → "LOAN_CREATED"
- loanCreatedAt

---

### `updateWithDisbursement()`
**File:** `loanMappingService.js:245`  
**Updates:**
- status → "DISBURSED"
- disbursedAt

---

### `updateLoanMapping()`
**File:** `loanMappingService.js:283`  
**Updates:**
- Any field provided in loanData parameter
- Flexible update method for various scenarios

---

## **QUERY METHODS**

- `getByEssApplicationNumber()` - Find by ESS application number
- `getByEssLoanNumberAlias()` - Find by loan number alias
- `getByMifosLoanId()` - Find by MIFOS loan ID
- `findByFspReference()` - Find by FSP reference number
- `findByMifosClientId()` - Find by MIFOS client ID

---

## **INDEXES**

1. Single Field Indexes:
   - `essApplicationNumber`
   - `essCheckNumber`
   - `essLoanNumberAlias`
   - `fspReferenceNumber` (sparse)
   - `mifosClientId`
   - `mifosLoanId`
   - `mifosLoanAccountNumber`
   - `status`

2. Compound Indexes:
   - `{ essApplicationNumber: 1, essLoanNumber: 1 }`
   - `{ status: 1, createdAt: -1 }`
   - `{ essApplicationNumber: 1, status: 1 }`

---

## **SUMMARY**

**Total Fields:** 20 (18 defined + 2 auto-generated)

**Updated During:**
- **LOAN_OFFER_REQUEST:** 10 fields
- **LOAN_INITIAL_APPROVAL_NOTIFICATION:** 4 fields
- **LOAN_FINAL_APPROVAL_NOTIFICATION:** 8 fields (if approved)
- **Throughout Lifecycle:** metadata, status, timestamps

**Critical Path Fields:**
1. essApplicationNumber → essLoanNumberAlias → mifosClientId → mifosLoanId → status: DISBURSED
