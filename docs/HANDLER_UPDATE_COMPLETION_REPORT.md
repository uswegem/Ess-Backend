# Message Handlers Update - Completion Report

## ✅ Implementation Complete

**Date:** December 19, 2025  
**Status:** Successfully Deployed and Tested  
**Environment:** Production (135.181.33.13:3002)

---

## What Was Updated

### 1. Import Statement Added
**File:** `src/controllers/apiController.js` (Line ~18)

```javascript
const { rejectLoan, cancelLoan, completeLoan, setWaitingForLiquidation } = require('../utils/loanStatusHelpers');
```

### 2. LOAN_CANCELLATION_NOTIFICATION Handler
**File:** `src/controllers/apiController.js` (Line ~1372)

**Before:**
```javascript
const updateResult = await LoanMappingService.updateStatus(
    applicationNumber,
    'CANCELLED',
    {
        reason: reason || 'Loan cancelled by employee',
        cancelledAt: new Date(),
        cancelledBy: 'Employee',
        fspReferenceNumber: fspReferenceNumber || loanMapping.fspReferenceNumber
    }
);
```

**After:**
```javascript
// Update loan mapping status to CANCELLED using helper function
await cancelLoan(loanMapping, 'EMPLOYEE', reason || 'Loan cancelled by employee');

// Update FSP reference if provided
if (fspReferenceNumber && fspReferenceNumber !== loanMapping.fspReferenceNumber) {
    loanMapping.fspReferenceNumber = fspReferenceNumber;
    await loanMapping.save();
}
```

**Benefits:**
- ✅ Actor tracked as 'EMPLOYEE'
- ✅ Reason stored in `cancellationReason` field
- ✅ Timestamp automatically set in `cancelledBy` field
- ✅ Consistent logging via helper function

---

### 3. LOAN_FINAL_APPROVAL_NOTIFICATION Handler (Rejection Path)
**File:** `src/controllers/apiController.js` (Line ~1490)

**Before:**
```javascript
const loanMappingData = {
    essLoanNumberAlias: messageDetails.LoanNumber,
    fspReferenceNumber: messageDetails.FSPReferenceNumber || null,
    status: messageDetails.Approval === 'APPROVED' ? 'FINAL_APPROVAL_RECEIVED' : 'REJECTED',
    essApplicationNumber: messageDetails.ApplicationNumber,
    essCheckNumber: messageDetails.FSPReferenceNumber || messageDetails.CheckNumber,
    productCode: '17',
    requestedAmount: messageDetails.LoanAmount || messageDetails.RequestedAmount || 5000000,
    tenure: messageDetails.LoanTenure || messageDetails.Tenure || 60,
    reason: messageDetails.Reason || (messageDetails.Approval === 'REJECTED' ? 'Application rejected' : null),
    finalApprovalReceivedAt: new Date().toISOString()
};
```

**After:**
```javascript
const loanMappingData = {
    essLoanNumberAlias: messageDetails.LoanNumber,
    fspReferenceNumber: messageDetails.FSPReferenceNumber || null,
    status: messageDetails.Approval === 'APPROVED' ? 'FINAL_APPROVAL_RECEIVED' : 'REJECTED',
    essApplicationNumber: messageDetails.ApplicationNumber,
    essCheckNumber: messageDetails.FSPReferenceNumber || messageDetails.CheckNumber,
    productCode: '17',
    requestedAmount: messageDetails.LoanAmount || messageDetails.RequestedAmount || 5000000,
    tenure: messageDetails.LoanTenure || messageDetails.Tenure || 60,
    finalApprovalReceivedAt: new Date().toISOString()
};

// Handle rejection with proper actor tracking
if (messageDetails.Approval === 'REJECTED') {
    const reason = messageDetails.Reason || 'Application rejected by employer';
    if (existingMapping) {
        await rejectLoan(existingMapping, 'EMPLOYER', reason);
        logger.info('✅ Loan rejected with actor tracking:', {
            applicationNumber: messageDetails.ApplicationNumber,
            rejectedBy: 'EMPLOYER',
            reason: reason
        });
    } else {
        // For new mapping, set rejection info in metadata
        loanMappingData.rejectedBy = 'EMPLOYER';
        loanMappingData.rejectionReason = reason;
    }
}
```

**Benefits:**
- ✅ Actor tracked as 'EMPLOYER' (ESS sends final approval on behalf of employer)
- ✅ Reason stored in `rejectionReason` field
- ✅ Works for both existing and new mappings
- ✅ Proper logging for audit trail

---

## Test Results

### ✅ All Tests Passed

```
Test 1: Rejection Handler
✓ Status: REJECTED
✓ Rejected by: EMPLOYER
✓ Rejection reason: Test rejection by employer
✅ REJECTION TEST PASSED

Test 2: Cancellation Handler
✓ Status: CANCELLED
✓ Cancelled by: EMPLOYEE
✓ Cancellation reason: Test cancellation by employee
✅ CANCELLATION TEST PASSED

Test 3: Query Capability
✓ Can query by rejectedBy: EMPLOYER
✓ Can query by cancelledBy: EMPLOYEE
✅ QUERY TEST PASSED

Test 4: Statistics
✓ Aggregation by actor working
✅ STATISTICS TEST PASSED
```

---

## Actor Assignment Logic

### LOAN_FINAL_APPROVAL_NOTIFICATION
- **Status:** REJECTED
- **Actor:** EMPLOYER
- **Rationale:** ESS (Employer Support System) sends final approval/rejection on behalf of the employer after they review the loan application

### LOAN_CANCELLATION_NOTIFICATION
- **Status:** CANCELLED
- **Actor:** EMPLOYEE
- **Rationale:** Cancellation notifications are typically sent when an employee withdraws their loan application

---

## Database Impact

### New Fields Populated

When a loan is rejected via LOAN_FINAL_APPROVAL_NOTIFICATION:
```javascript
{
  status: 'REJECTED',
  rejectedBy: 'EMPLOYER',          // NEW
  rejectionReason: 'Reason text',  // NEW
  // ... other fields
}
```

When a loan is cancelled via LOAN_CANCELLATION_NOTIFICATION:
```javascript
{
  status: 'CANCELLED',
  cancelledBy: 'EMPLOYEE',            // NEW
  cancellationReason: 'Reason text',  // NEW
  // ... other fields
}
```

---

## Query Examples

### Find All Employer Rejections
```javascript
const employerRejections = await LoanMapping.find({
  status: 'REJECTED',
  rejectedBy: 'EMPLOYER'
});
```

### Find All Employee Cancellations
```javascript
const employeeCancellations = await LoanMapping.find({
  status: 'CANCELLED',
  cancelledBy: 'EMPLOYEE'
});
```

### Get Statistics
```javascript
const { getStatusStatistics } = require('./src/utils/loanStatusHelpers');
const stats = await getStatusStatistics(LoanMapping);

console.log('Employer rejections:', stats.rejections.EMPLOYER);
console.log('Employee cancellations:', stats.cancellations.EMPLOYEE);
```

---

## Monitoring Queries

### Daily Rejection Summary
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

const rejections = await LoanMapping.aggregate([
  {
    $match: {
      status: 'REJECTED',
      updatedAt: { $gte: today },
      rejectedBy: { $exists: true }
    }
  },
  {
    $group: {
      _id: '$rejectedBy',
      count: { $sum: 1 }
    }
  }
]);

// Output: [{ _id: 'EMPLOYER', count: 5 }, { _id: 'FSP', count: 2 }]
```

### Cancellation Trend
```javascript
const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const cancellations = await LoanMapping.find({
  status: 'CANCELLED',
  updatedAt: { $gte: last7Days },
  cancelledBy: { $exists: true }
}).select('cancelledBy cancellationReason updatedAt');
```

---

## Logging Output

### Rejection Log Example
```
info: Loan rejected {
  "applicationNumber": "ESS1766176180125",
  "rejectedBy": "EMPLOYER",
  "reason": "Test rejection by employer",
  "service": "ess-app",
  "timestamp": "2025-12-19 23:29:40"
}
```

### Cancellation Log Example
```
info: Loan cancelled {
  "applicationNumber": "ESS1766176180601",
  "cancelledBy": "EMPLOYEE",
  "reason": "Test cancellation by employee",
  "service": "ess-app",
  "timestamp": "2025-12-19 23:29:40"
}
```

---

## Additional Handlers to Update (Future)

While the two main handlers are now updated, consider updating these in the future:

### 1. FSP-initiated Rejection
**Scenario:** FSP rejects during initial screening  
**Handler:** Loan offer handlers  
**Actor:** 'FSP'  
**Priority:** Medium

### 2. FSP-initiated Cancellation
**Scenario:** FSP cancels after approval (e.g., compliance issue)  
**Handler:** Custom cancellation endpoint  
**Actor:** 'FSP'  
**Priority:** Low

### 3. System-initiated Rejection/Cancellation
**Scenario:** Automatic rejection due to technical errors or timeouts  
**Handler:** Various error handlers  
**Actor:** 'SYSTEM'  
**Priority:** Low

---

## Backward Compatibility

✅ **Fully Compatible**
- Existing code continues to work
- New fields are optional
- Old loan records unaffected
- Queries without actor filters still work

---

## Files Modified

### Production Server
- ✅ `/home/uswege/ess/src/controllers/apiController.js` - Updated
- ✅ `/home/uswege/ess/test-updated-handlers.js` - Created

### Local Repository
- ✅ `src/controllers/apiController.js` - Updated
- ✅ `test-updated-handlers.js` - Created

---

## Related Documentation

- **Implementation Guide:** `LOAN_STATES_IMPLEMENTATION_GUIDE.md`
- **State Comparison:** `ESS_LOAN_STATES_COMPARISON.md`
- **Deployment Summary:** `LOAN_STATES_DEPLOYMENT_SUMMARY.md`
- **Quick Reference:** `LOAN_STATES_QUICK_REFERENCE.md`

---

## Success Metrics

✅ **Code Quality:**
- Helper functions properly imported
- Actor tracking implemented
- Logging enhanced

✅ **Functionality:**
- All tests passing
- No breaking changes
- Backward compatible

✅ **Auditability:**
- Rejection actor tracked
- Cancellation actor tracked
- Reasons stored
- Timestamps automatic

---

## Next Steps (Optional Enhancements)

1. **Frontend Updates**
   - Display actor information in loan details
   - Add filters for rejection/cancellation by actor
   - Show rejection/cancellation reasons in UI

2. **Reporting**
   - Add actor-based rejection rate reports
   - Track cancellation patterns by actor
   - Alert on high employer rejection rates

3. **Additional Handlers**
   - Update FSP rejection handlers (if any)
   - Add system-initiated rejection/cancellation tracking

---

**Status:** ✅ Implementation Complete and Verified  
**Production:** Live and Tested  
**Next Action:** Monitor production logs for proper actor tracking in real loan rejections/cancellations
