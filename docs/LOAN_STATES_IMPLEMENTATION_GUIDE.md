# Loan States Implementation - Complete Guide

## ✅ What Was Implemented

### 1. Model Updates (src/models/LoanMapping.js)

**New Status Values:**
- ✅ `COMPLETED` - Loan fully repaid and closed
- ✅ `WAITING_FOR_LIQUIDATION` - Takeover loan awaiting liquidation

**New Actor Tracking Fields:**
- ✅ `rejectedBy` - Who rejected (FSP/EMPLOYEE/EMPLOYER/SYSTEM)
- ✅ `cancelledBy` - Who cancelled (FSP/EMPLOYEE/EMPLOYER/SYSTEM)
- ✅ `rejectionReason` - Text reason for rejection
- ✅ `cancellationReason` - Text reason for cancellation

**New Timestamp Fields:**
- ✅ `completedAt` - When loan was completed
- ✅ `liquidationRequestedAt` - When liquidation was requested

**Updated Methods:**
- ✅ `updateStatus()` - Now accepts actor and reason parameters

### 2. Frontend Config (frontend/src/config/index.js)

**New Status Configurations:**
- ✅ `COMPLETED` - Green, "Loan fully repaid and closed"
- ✅ `WAITING_FOR_LIQUIDATION` - Orange, "Loan takeover - waiting for liquidation"

### 3. Helper Functions (src/utils/loanStatusHelpers.js)

**Status Update Functions:**
- ✅ `rejectLoan(loan, actor, reason)` - Reject with actor tracking
- ✅ `cancelLoan(loan, actor, reason)` - Cancel with actor tracking
- ✅ `completeLoan(loan)` - Mark loan as completed
- ✅ `setWaitingForLiquidation(loan)` - Set takeover liquidation state

**Utility Functions:**
- ✅ `getStatusLabel(status, loan)` - Get human-readable status with actor
- ✅ `canTransitionTo(from, to)` - Validate state transitions
- ✅ `getStatusStatistics(LoanMapping)` - Get status analytics

### 4. Migration Script (migrate-loan-states.js)

**Features:**
- ✅ Identifies completed loans from Mifos
- ✅ Updates DISBURSED → COMPLETED for closed loans
- ✅ Identifies takeover loans awaiting liquidation
- ✅ Backfills actor information for existing loans
- ✅ Dry-run mode for safe testing

### 5. Test Suite (test-new-loan-states.js)

**Tests:**
- ✅ Schema validation
- ✅ State transition rules
- ✅ Actor tracking
- ✅ Helper functions
- ✅ Status statistics
- ✅ Index verification

---

## 🚀 Deployment Steps

### Step 1: Deploy Model Changes

```bash
# On production server
cd /home/uswege/ess

# Backup current model
cp src/models/LoanMapping.js src/models/LoanMapping.js.backup

# Upload new files (already done via scp or git pull)
# Verify syntax
node -c src/models/LoanMapping.js
node -c src/utils/loanStatusHelpers.js

# Restart application
pm2 restart ess-app
```

### Step 2: Run Migration (Dry Run First)

```bash
# Test migration without making changes
node migrate-loan-states.js --dry-run

# Review output carefully
# If everything looks good, run actual migration
node migrate-loan-states.js
```

### Step 3: Verify Changes

```bash
# Run test suite
node test-new-loan-states.js

# Check a few loans manually
mongo
use your_database
db.loanmappings.findOne({ status: 'COMPLETED' })
db.loanmappings.findOne({ status: 'WAITING_FOR_LIQUIDATION' })
```

### Step 4: Update Handlers

Update existing handlers to use new states and helper functions:

**Example: Update rejection handler**
```javascript
// OLD WAY
const { rejectLoan } = require('../utils/loanStatusHelpers');

// Instead of:
loanMapping.status = 'REJECTED';
await loanMapping.save();

// Use:
await rejectLoan(loanMapping, 'FSP', 'Credit score insufficient');
```

**Files to Update:**
- [ ] `src/controllers/apiController.js` - LOAN_FINAL_APPROVAL_NOTIFICATION (REJECTED)
- [ ] `src/controllers/apiController.js` - LOAN_CANCELLATION_NOTIFICATION
- [ ] `src/controllers/handlers/loanOfferHandler.js` - Rejection logic
- [ ] `src/controllers/handlers/takeoverOfferHandler.js` - Liquidation state
- [ ] `src/webhooks/mifosWebhookHandler.js` - Loan closure events

---

## 📝 Handler Update Examples

### Example 1: FSP Rejection (LOAN_FINAL_APPROVAL_NOTIFICATION)

**Location:** `src/controllers/apiController.js` around line 1103

**Before:**
```javascript
if (approval === 'REJECTED') {
    loanMapping.status = 'REJECTED';
    await loanMapping.save();
}
```

**After:**
```javascript
const { rejectLoan } = require('../utils/loanStatusHelpers');

if (approval === 'REJECTED') {
    const reason = parsedData.Document.Data.MessageDetails.Reason || 'Rejected by ESS';
    await rejectLoan(loanMapping, 'FSP', reason);
}
```

### Example 2: Employee Cancellation (LOAN_CANCELLATION_NOTIFICATION)

**Location:** `src/controllers/apiController.js` around line 987

**Before:**
```javascript
loanMapping.status = 'CANCELLED';
await loanMapping.save();
```

**After:**
```javascript
const { cancelLoan } = require('../utils/loanStatusHelpers');

const reason = parsedData.Document.Data.MessageDetails.Reason || 'Cancelled by employee';
await cancelLoan(loanMapping, 'EMPLOYEE', reason);
```

### Example 3: Loan Completion (Mifos Webhook)

**Location:** `src/webhooks/mifosWebhookHandler.js`

**Add new handler:**
```javascript
const { completeLoan } = require('../utils/loanStatusHelpers');

async function handleLoanClosed(event) {
  try {
    const loanId = event.loanId;
    const loanMapping = await LoanMapping.findOne({ mifosLoanId: loanId });
    
    if (!loanMapping) {
      logger.warn('Loan mapping not found for closed loan', { loanId });
      return;
    }

    if (loanMapping.status === 'DISBURSED') {
      await completeLoan(loanMapping);
      logger.info('Loan marked as completed', {
        applicationNumber: loanMapping.essApplicationNumber,
        loanId: loanId
      });
    }
  } catch (error) {
    logger.error('Error handling loan closure', { error: error.message });
  }
}

// Register webhook handler
if (event.action === 'CLOSE') {
  await handleLoanClosed(event);
}
```

### Example 4: Takeover Liquidation

**Location:** `src/controllers/handlers/takeoverOfferHandler.js`

**Add liquidation state:**
```javascript
const { setWaitingForLiquidation } = require('../../utils/loanStatusHelpers');

// After creating takeover loan in Mifos, before disbursement
if (takeoverData.requiresLiquidation) {
  await setWaitingForLiquidation(loanMapping);
  
  // Send liquidation request to old lender
  await sendLiquidationRequest(takeoverData);
}
```

---

## 🔍 Query Examples

### Find All Completed Loans
```javascript
const completedLoans = await LoanMapping.find({ 
  status: 'COMPLETED' 
}).sort({ completedAt: -1 });
```

### Find Loans Rejected by FSP
```javascript
const fspRejections = await LoanMapping.find({ 
  status: 'REJECTED',
  rejectedBy: 'FSP'
});
```

### Find Loans Cancelled by Employee
```javascript
const employeeCancellations = await LoanMapping.find({ 
  status: 'CANCELLED',
  cancelledBy: 'EMPLOYEE'
});
```

### Find Takeover Loans Awaiting Liquidation
```javascript
const awaitingLiquidation = await LoanMapping.find({ 
  status: 'WAITING_FOR_LIQUIDATION' 
}).sort({ liquidationRequestedAt: 1 });
```

### Get Rejection Statistics
```javascript
const { getStatusStatistics } = require('./src/utils/loanStatusHelpers');
const stats = await getStatusStatistics(LoanMapping);
console.log('Rejections by actor:', stats.rejections);
// Output: { FSP: 45, EMPLOYEE: 12, EMPLOYER: 8, SYSTEM: 3 }
```

---

## 🎨 Frontend Display Updates

### Update Loan Detail Component

**Show actor for rejected/cancelled loans:**
```jsx
function LoanStatus({ loan }) {
  const status = loan.status;
  const statusConfig = LOAN_STATUS[status];
  
  return (
    <div>
      <Badge color={statusConfig.color}>
        {statusConfig.label}
      </Badge>
      
      {status === 'REJECTED' && loan.rejectedBy && (
        <div className="mt-2 text-sm text-gray-600">
          Rejected by: {loan.rejectedBy}
          {loan.rejectionReason && (
            <p className="italic">"{loan.rejectionReason}"</p>
          )}
        </div>
      )}
      
      {status === 'CANCELLED' && loan.cancelledBy && (
        <div className="mt-2 text-sm text-gray-600">
          Cancelled by: {loan.cancelledBy}
          {loan.cancellationReason && (
            <p className="italic">"{loan.cancellationReason}"</p>
          )}
        </div>
      )}
      
      {status === 'COMPLETED' && loan.completedAt && (
        <div className="mt-2 text-sm text-gray-600">
          Completed on: {new Date(loan.completedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
```

### Update Dashboard Filters

**Add actor-based filters:**
```jsx
<Select label="Rejection Actor" onChange={handleFilterChange}>
  <option value="">All</option>
  <option value="FSP">FSP</option>
  <option value="EMPLOYEE">Employee</option>
  <option value="EMPLOYER">Employer</option>
  <option value="SYSTEM">System</option>
</Select>
```

---

## ✅ Testing Checklist

### Model Tests
- [ ] COMPLETED status can be set
- [ ] WAITING_FOR_LIQUIDATION status can be set
- [ ] rejectedBy field accepts valid actors
- [ ] cancelledBy field accepts valid actors
- [ ] Timestamps are set correctly
- [ ] updateStatus() method works with actor params

### State Transition Tests
- [ ] DISBURSED → COMPLETED is allowed
- [ ] APPROVED → WAITING_FOR_LIQUIDATION is allowed
- [ ] WAITING_FOR_LIQUIDATION → DISBURSED is allowed
- [ ] COMPLETED → DISBURSED is blocked (terminal state)
- [ ] REJECTED → DISBURSED is blocked (terminal state)

### Helper Function Tests
- [ ] rejectLoan() updates status and actor
- [ ] cancelLoan() updates status and actor
- [ ] completeLoan() updates status and timestamp
- [ ] setWaitingForLiquidation() updates status and timestamp
- [ ] getStatusLabel() includes actor name
- [ ] canTransitionTo() validates correctly
- [ ] getStatusStatistics() returns accurate counts

### Integration Tests
- [ ] Loan rejection handler uses rejectLoan()
- [ ] Loan cancellation handler uses cancelLoan()
- [ ] Mifos webhook marks loans as COMPLETED
- [ ] Takeover flow sets WAITING_FOR_LIQUIDATION
- [ ] Frontend displays actor information
- [ ] Dashboard filters by actor work

### Migration Tests
- [ ] Dry run completes without errors
- [ ] Completed loans identified correctly
- [ ] Liquidation loans identified correctly
- [ ] Actor backfill works for existing loans
- [ ] No data loss or corruption

---

## 📊 Monitoring Queries

### Daily Statistics
```javascript
// Run daily to track status distribution
const stats = await getStatusStatistics(LoanMapping);
console.log('Loan Status Summary:', JSON.stringify(stats, null, 2));
```

### Alert on High Rejection Rate
```javascript
const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
const recentRejections = await LoanMapping.countDocuments({
  status: 'REJECTED',
  updatedAt: { $gte: last24h }
});

const recentApplications = await LoanMapping.countDocuments({
  createdAt: { $gte: last24h }
});

const rejectionRate = (recentRejections / recentApplications) * 100;
if (rejectionRate > 30) {
  console.warn(`⚠️  High rejection rate: ${rejectionRate.toFixed(1)}%`);
}
```

---

## 🔄 Rollback Plan

If issues occur, rollback procedure:

```bash
# 1. Stop application
pm2 stop ess-app

# 2. Restore old model
cp src/models/LoanMapping.js.backup src/models/LoanMapping.js

# 3. Restart application
pm2 restart ess-app

# 4. Note: New states won't cause errors (MongoDB is schema-less)
#    Existing COMPLETED/WAITING_FOR_LIQUIDATION loans will remain
#    but won't be queryable via model enum until re-deployed
```

---

## 📚 Documentation Updates Needed

- [ ] Update API documentation with new statuses
- [ ] Update ESS integration docs
- [ ] Add actor tracking to audit trail docs
- [ ] Update business process flows
- [ ] Add migration instructions to deployment guide

---

## 🎯 Success Criteria

✅ Implementation is successful when:
1. All tests pass (run `node test-new-loan-states.js`)
2. Migration completes without errors
3. Existing loans continue to function normally
4. New states are queryable and filterable
5. Actor information is tracked for new rejections/cancellations
6. Frontend displays new states correctly
7. No performance degradation in queries

---

**Status:** ✅ Implementation Complete - Ready for Deployment  
**Next Step:** Run `node test-new-loan-states.js` to verify all changes
