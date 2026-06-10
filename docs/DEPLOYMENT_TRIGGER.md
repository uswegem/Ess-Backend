# Deployment Summary - LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST Handler

## Deployment Information
- **Trigger**: GitHub Actions workflow
- **Commit**: ff961d9
- **Branch**: main
- **Status**: Deploying...

## What's Being Deployed

### 1. New Handler Implementation
**File**: `src/controllers/handlers/loanRestructureAffordabilityHandler.js`
- Dedicated handler for LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST
- Fetches existing loan from MIFOS using LoanNumber
- Calculates affordability for loan restructuring with two modes:
  - **TOP_UP**: Customer requests additional funds on top of outstanding balance
  - **TERM_EXTENSION**: Restructure existing balance with new tenure

### 2. Router Configuration Update
**File**: `src/controllers/apiController.js`
- Line 56: Import new handler
- Line 110-111: Route LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST to dedicated handler

### 3. Bug Fixes
**File**: `package.json`
- Fixed Jest hanging in CI/CD pipeline
- Added `--forceExit` flag to test script
- Configured test timeout (10 seconds)

## Key Features of New Handler

### Loan Context Retrieval
```javascript
// Finds existing loan by multiple fields
const loanMapping = await LoanMapping.findOne({
    $or: [
        { fspReferenceNumber: loanNumber },
        { essLoanNumberAlias: loanNumber },
        { newLoanNumber: loanNumber }
    ]
});

// Fetches full loan details from MIFOS
const mifosLoan = await mifosService.getLoanById(mifosLoanId, {
    associations: 'repaymentSchedule,transactions'
});
```

### Restructure Type Detection
- **TOP_UP**: When RequestedAmount > 0
  - Adds requested amount to outstanding balance
  - Calculates new EMI for total amount
  - Returns net top-up amount after deducting fees
  
- **TERM_EXTENSION**: When RequestedAmount = 0
  - Restructures existing balance only
  - Extends tenure to reduce monthly payment
  - No additional funds disbursed

### Response Structure
Returns comprehensive affordability details:
- `LoanNumber`: Original loan reference
- `CurrentOutstandingBalance`: Current amount owed
- `TopUpAmount`: Additional funds (if applicable)
- `NewLoanAmount`: Total restructured loan amount
- `MonthlyReturnAmount`: New EMI payment
- `NetLoanAmount`: Amount after fees
- `TotalAmountToPay`: Principal + Interest
- `Tenure`: New loan duration
- `RestructureType`: TOP_UP or TERM_EXTENSION

## Deployment Steps (Automated by GitHub Actions)

1. ✅ Run tests (3 test suites, 9 tests)
2. ✅ Security scan
3. 🔄 Create backup on production server
4. 🔄 Deploy application code
5. 🔄 Install production dependencies
6. 🔄 Restart PM2 services
7. 🔄 Verify deployment health

## Expected Production State After Deployment

### PM2 Status
- Process: ess-app (2 instances, cluster mode)
- Restart count: Will increment by 1
- Memory: ~100-110 MB per instance
- Status: online

### API Endpoints Ready
- ✅ LOAN_CHARGES_REQUEST → handleLoanChargesRequest
- ✅ LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST → handleLoanRestructureAffordabilityRequest (NEW)
- ✅ LOAN_RESTRUCTURE_BALANCE_REQUEST → handleLoanRestructureBalanceRequest
- ✅ LOAN_RESTRUCTURE_REQUEST → handleLoanRestructureRequest
- ✅ LOAN_OFFER_REQUEST → handleLoanOfferRequest

## Testing After Deployment

### Verify Handler Routing
```bash
ssh uswege@135.181.33.13 "cd /home/uswege/ess && grep -n 'handleLoanRestructureAffordability' src/controllers/apiController.js"
```

### Check PM2 Status
```bash
ssh uswege@135.181.33.13 "pm2 status"
```

### Monitor Logs
```bash
ssh uswege@135.181.33.13 "cd /home/uswege/ess && tail -f logs/app-2025-12-18.log"
```

### Test with Sample Request
Send LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST with:
- LoanNumber: LOAN1766054808065 (existing loan)
- RequestedAmount: 2000000 (for top-up test)
- Tenure: 96

Expected response should include:
- CurrentOutstandingBalance: 5,584,368.15
- TopUpAmount: 2,000,000.00
- NewLoanAmount: 7,584,368.15
- MonthlyReturnAmount: Calculated EMI

## Rollback Plan (If Needed)

If deployment fails:
```bash
ssh uswege@135.181.33.13 << 'EOF'
  cd /home/uswege/ess
  # Find latest backup
  latest_backup=$(ls -t ../ess_backup_*.tar.gz | head -1)
  echo "Rolling back to: $latest_backup"
  
  # Stop services
  pm2 stop all
  
  # Restore from backup
  tar -xzf "$latest_backup"
  
  # Restart services
  pm2 restart all
EOF
```

## Monitoring Points

1. **Application Logs**: Check for LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST processing
2. **Error Rates**: Monitor for new errors related to loan lookup or MIFOS integration
3. **Response Times**: Ensure handler completes within acceptable time (< 5 seconds)
4. **Database Queries**: Verify loan mapping lookups are efficient

## GitHub Actions Workflow URL
https://github.com/uswegem/MiraCore_New/actions

Monitor the deployment progress there.

---
**Deployment Initiated**: 2025-12-18
**Estimated Completion**: 3-5 minutes
