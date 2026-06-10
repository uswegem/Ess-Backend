# LOAN_RESTRUCTURE_REQUEST Implementation - Deployment Guide

## Overview
Implemented complete LOAN_RESTRUCTURE_REQUEST flow with MIFOS reschedule API integration and webhook-based LOAN_INITIAL_APPROVAL_NOTIFICATION callback.

## Files Modified/Created

### 1. NEW: src/controllers/handlers/loanRestructureHandler.js
- **Purpose**: Handle LOAN_RESTRUCTURE_REQUEST messages
- **Features**:
  - Validates checkNumber, requestedAmount, tenure
  - Looks up LoanMappings by checkNumber to get mifosLoanId
  - Sends immediate ACK response (ResponseCode 8000)
  - Calls MIFOS POST /v1/loans/{loanId}/schedule with reschedule payload
  - Updates LoanMappings with restructure info and rescheduleId
  - Stores pendingCallback for webhook to trigger LOAN_INITIAL_APPROVAL_NOTIFICATION
  - Creates AuditLog entry
  - Helper: calculateAdjustedDueDate(tenureMonths)

### 2. UPDATED: src/controllers/handlers/mifosWebhookHandler.js
- **Added**:
  - processWebhookEvent() - Main webhook event processor
  - handleRescheduleApproval() - Handles RESCHEDULELOAN/APPROVE events
  - sendLoanInitialApprovalNotification() - Sends callback to ESS_UTUMISHI
  - handleLoanDisbursement() - Placeholder for future disbursement handling
- **Features**:
  - Detects reschedule approval webhooks from MIFOS
  - Looks up LoanMappings by rescheduleId
  - Extracts pendingCallback data
  - Sends LOAN_INITIAL_APPROVAL_NOTIFICATION to ESS_UTUMISHI
  - Updates LoanMappings status to 'RESTRUCTURE_APPROVED'
  - Creates AuditLog entries for tracking
  - Asynchronous processing (non-blocking ACK response)

### 3. UPDATED: src/controllers/apiController.js
- **Line 39**: Added import: `const handleLoanRestructureRequest = require('./handlers/loanRestructureHandler')`
- **Line 102**: Added case statement:
  ```javascript
  case 'LOAN_RESTRUCTURE_REQUEST':
      trackLoanMessage('LOAN_RESTRUCTURE_REQUEST', 'processing');
      return await handleLoanRestructureRequest(parsedData, res);
  ```
- **Line 1402**: Added export: `exports.handleLoanRestructureRequest = handleLoanRestructureRequest`

## Workflow Diagram

```
ESS_UTUMISHI
    |
    | LOAN_RESTRUCTURE_REQUEST
    v
Node Backend (apiController.js)
    |
    | Route to handler
    v
loanRestructureHandler.js
    |
    ├─> Send ACK (ResponseCode 8000) ─────────────────> ESS_UTUMISHI
    |
    ├─> Look up LoanMappings (checkNumber → mifosLoanId)
    |
    ├─> Call MIFOS POST /v1/loans/{loanId}/schedule
    |
    ├─> Update LoanMappings:
    |   - rescheduleId
    |   - status: 'RESTRUCTURE_PENDING'
    |   - pendingCallback: { type, originalMessage, timestamp }
    |
    └─> Create AuditLog entry

... Time passes (MIFOS approval workflow) ...

MIFOS
    |
    | Webhook: RESCHEDULELOAN/APPROVE
    v
Node Backend (/api/webhook/mifos)
    |
    v
mifosWebhookHandler.js
    |
    ├─> Send ACK (ResponseCode 8000) ─────────────────> MIFOS
    |
    ├─> processWebhookEvent() - async processing
    |
    ├─> handleRescheduleApproval()
    |   |
    |   ├─> Look up LoanMappings (rescheduleId)
    |   |
    |   ├─> Extract pendingCallback
    |   |
    |   └─> sendLoanInitialApprovalNotification()
    |       |
    |       ├─> Build LOAN_INITIAL_APPROVAL_NOTIFICATION
    |       |
    |       ├─> POST to ESS_CALLBACK_URL ─────────────> ESS_UTUMISHI
    |       |
    |       ├─> Update LoanMappings:
    |       |   - status: 'RESTRUCTURE_APPROVED'
    |       |   - remove pendingCallback
    |       |
    |       └─> Create AuditLog entry
    |
    └─> Done
```

## MIFOS Reschedule API Details

### Endpoint
```
POST /v1/loans/{loanId}/schedule
```

### Payload Structure
```javascript
{
    rescheduleFromDate: "dd MMMM yyyy",  // e.g., "15 January 2025"
    submittedOnDate: "dd MMMM yyyy",
    rescheduleReasonId: 1,
    rescheduleReasonComment: "Loan restructure request from borrower",
    adjustedDueDate: "dd MMMM yyyy",
    locale: "en",
    dateFormat: "dd MMMM yyyy"
}
```

### Response
Returns rescheduleId which is stored in LoanMappings for webhook correlation.

## MIFOS Webhook Payload

### Event: RESCHEDULELOAN/APPROVE
```javascript
{
    entityName: "RESCHEDULELOAN",
    actionName: "APPROVE",
    entity: {
        id: <rescheduleId>,
        loanId: <loanId>,
        rescheduleFromDate: "15 January 2025",
        rescheduleReasonId: 1,
        status: {
            id: 200,
            code: "loanStatusType.approved",
            value: "Approved"
        }
    },
    createdDate: "2025-01-15T10:30:00.000Z"
}
```

## LoanMappings Schema Updates

### New Fields
```javascript
{
    rescheduleId: Number,              // MIFOS reschedule request ID
    newAmount: Number,                 // Requested restructure amount
    newTenure: Number,                 // Requested new tenure
    restructureRequested: Boolean,     // Flag for restructure status
    restructureRequestedDate: Date,
    restructureApprovedDate: Date,
    pendingCallback: {
        type: String,                  // e.g., 'LOAN_INITIAL_APPROVAL_NOTIFICATION'
        originalMessage: Object,       // Original request data
        timestamp: Date
    }
}
```

## LOAN_INITIAL_APPROVAL_NOTIFICATION Structure

### XML Format
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>ESS_LOAN_IA_1737000000000abc</MsgId>
            <MessageType>LOAN_INITIAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>123456789</CheckNumber>
            <LoanNumber>LN1234567</LoanNumber>
            <ApplicationNumber>APP1234567</ApplicationNumber>
            <FSPCode>FL8090</FSPCode>
            <ApprovedAmount>5000000</ApprovedAmount>
            <Tenure>72</Tenure>
            <MonthlyInstallment>125000</MonthlyInstallment>
            <InterestRate>24</InterestRate>
            <ProcessingFee>50000</ProcessingFee>
            <Insurance>25000</Insurance>
            <ApprovalDate>2025-01-15</ApprovalDate>
            <DisbursementDate>2025-01-15</DisbursementDate>
        </MessageDetails>
    </Data>
</Document>
```

## Deployment Steps

### 1. Upload Files (COMPLETED)
```bash
# From local machine
cd /c/laragon/www/ess

scp src/controllers/handlers/loanRestructureHandler.js \
    uswege@135.181.33.13:/home/uswege/ess/src/controllers/handlers/

scp src/controllers/handlers/mifosWebhookHandler.js \
    uswege@135.181.33.13:/home/uswege/ess/src/controllers/handlers/

scp src/controllers/apiController.js \
    uswege@135.181.33.13:/home/uswege/ess/src/controllers/
```

### 2. Restart PM2
```bash
# SSH to production server
ssh uswege@135.181.33.13

# Navigate to project directory
cd /home/uswege/ess

# Restart all PM2 processes
pm2 restart all

# Verify processes are running
pm2 list

# Check logs
pm2 logs --lines 50
```

### 3. Verify Deployment
```bash
# Check server is responding
curl -X POST http://135.181.33.13:3002/api/health

# Check files are in place
ls -lh /home/uswege/ess/src/controllers/handlers/loanRestructureHandler.js
ls -lh /home/uswege/ess/src/controllers/handlers/mifosWebhookHandler.js
ls -lh /home/uswege/ess/src/controllers/apiController.js

# Check for any errors in PM2 logs
pm2 logs ess-api --err --lines 100
```

## Testing

### Test Script
Use `test-loan-restructure-flow.js` to test the complete workflow.

```bash
# Run test script
node test-loan-restructure-flow.js
```

### Manual Testing Steps

#### Step 1: Send LOAN_RESTRUCTURE_REQUEST
```bash
curl -X POST http://135.181.33.13:3002/api/loan \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>ESS123456789</MsgId>
            <MessageType>LOAN_RESTRUCTURE_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>123456789</CheckNumber>
            <FirstName>JOHN</FirstName>
            <MiddleName>DOE</MiddleName>
            <LastName>SMITH</LastName>
            <Sex>M</Sex>
            <DateOfBirth>1980-05-15</DateOfBirth>
            <EmploymentDate>2010-03-01</EmploymentDate>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1200000</NetSalary>
            <OneThirdAmount>400000</OneThirdAmount>
            <TotalEmployeeDeduction>300000</TotalEmployeeDeduction>
            <RequestedAmount>5000000</RequestedAmount>
            <Tenure>72</Tenure>
            <FSPCode>FL8090</FSPCode>
            <ProductCode>SALARY_ADVANCE</ProductCode>
            <InterestRate>24</InterestRate>
            <ProcessingFee>50000</ProcessingFee>
            <Insurance>25000</Insurance>
            <PhysicalAddress>123 Main Street, Dar es Salaam</PhysicalAddress>
            <EmailAddress>john.smith@example.com</EmailAddress>
            <PhoneNumber>255712345678</PhoneNumber>
            <RetirementDate>2045-05-15</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
        </MessageDetails>
    </Data>
</Document>'
```

Expected Response:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>ESS1737000000000abc</MsgId>
            <MessageType>RESPONSE</MessageType>
        </Header>
        <MessageDetails>
            <ResponseCode>8000</ResponseCode>
            <Description>Loan restructure request received</Description>
        </MessageDetails>
    </Data>
</Document>
```

#### Step 2: Check LoanMappings
```bash
mongo miracore --eval "db.loanmappings.findOne({checkNumber: '123456789'})" | grep -A 10 pendingCallback
```

Should show:
```javascript
{
    pendingCallback: {
        type: 'LOAN_INITIAL_APPROVAL_NOTIFICATION',
        originalMessage: { /* original request data */ },
        timestamp: ISODate("2025-01-15T10:30:00.000Z")
    },
    rescheduleId: 123,
    status: 'RESTRUCTURE_PENDING'
}
```

#### Step 3: Check MIFOS for reschedule request
Login to MIFOS and verify reschedule request was created for the loan.

#### Step 4: Approve reschedule in MIFOS
Manually approve the reschedule request in MIFOS. This will trigger the webhook.

#### Step 5: Verify LOAN_INITIAL_APPROVAL_NOTIFICATION was sent
```bash
# Check AuditLog
mongo miracore --eval "db.auditlogs.find({
    checkNumber: '123456789',
    eventType: 'LOAN_INITIAL_APPROVAL_SENT'
}).sort({_id: -1}).limit(1).pretty()"

# Check PM2 logs
pm2 logs ess-api | grep "LOAN_INITIAL_APPROVAL_NOTIFICATION sent successfully"
```

#### Step 6: Simulate webhook (if MIFOS webhook not configured)
```bash
curl -X POST http://135.181.33.13:3002/api/webhook/mifos \
  -H "Content-Type: application/json" \
  -d '{
    "entityName": "RESCHEDULELOAN",
    "actionName": "APPROVE",
    "entity": {
        "id": 123,
        "loanId": 456,
        "rescheduleFromDate": "15 January 2025",
        "rescheduleReasonId": 1,
        "status": {
            "id": 200,
            "code": "loanStatusType.approved",
            "value": "Approved"
        }
    },
    "createdDate": "2025-01-15T10:30:00.000Z"
}'
```

## Environment Variables

Ensure these are set in `.env`:

```bash
# ESS Callback URL (where to send notifications)
ESS_CALLBACK_URL=http://utumishi-server/api/loan

# MIFOS API credentials
CBS_API_BASE_URL=https://mifos.example.com/fineract-provider/api/v1
CBS_MAKER_USERNAME=maker_user
CBS_MAKER_PASSWORD=maker_password
CBS_CHECKER_USERNAME=checker_user
CBS_CHECKER_PASSWORD=checker_password

# FSP Details
FSP_CODE=FL8090
FSP_NAME=ZE DONE
```

## Monitoring

### Key Log Messages

#### Success Flow
```
📥 MIFOS Webhook received: { entityName: 'RESCHEDULELOAN', actionName: 'APPROVE' }
🎯 Reschedule approved: { rescheduleId: 123, loanId: 456 }
Found loan mapping with pending callback: { checkNumber: '123456789', loanNumber: 'LN1234567' }
📤 Sending LOAN_INITIAL_APPROVAL_NOTIFICATION callback: { checkNumber: '123456789', url: '...' }
✅ LOAN_INITIAL_APPROVAL_NOTIFICATION sent successfully: { status: 200, checkNumber: '123456789' }
```

#### Error Scenarios
```
❌ No pending callback found for reschedule: 123
❌ Error sending LOAN_INITIAL_APPROVAL_NOTIFICATION: [error details]
```

### Database Queries

#### Check pending callbacks
```javascript
db.loanmappings.find({
    "pendingCallback.type": "LOAN_INITIAL_APPROVAL_NOTIFICATION",
    status: "RESTRUCTURE_PENDING"
}).pretty()
```

#### Check completed restructures
```javascript
db.loanmappings.find({
    status: "RESTRUCTURE_APPROVED",
    restructureApprovedDate: { $exists: true }
}).sort({ restructureApprovedDate: -1 }).limit(10).pretty()
```

#### Check audit trail
```javascript
db.auditlogs.find({
    eventType: { $in: [
        'LOAN_RESTRUCTURE_REQUESTED',
        'LOAN_RESTRUCTURE_APPROVED',
        'LOAN_INITIAL_APPROVAL_SENT',
        'LOAN_INITIAL_APPROVAL_SEND_FAILED'
    ]}
}).sort({ _id: -1 }).limit(20).pretty()
```

## Rollback Plan

If issues occur, rollback to previous versions:

```bash
# SSH to server
ssh uswege@135.181.33.13
cd /home/uswege/ess

# Restore from backup (if backups were made)
cp src/controllers/apiController.js.backup src/controllers/apiController.js
cp src/controllers/handlers/mifosWebhookHandler.js.backup src/controllers/handlers/mifosWebhookHandler.js
rm src/controllers/handlers/loanRestructureHandler.js

# Restart PM2
pm2 restart all
```

## Next Steps

1. ✅ Deploy files to production
2. ✅ Restart PM2
3. ⏳ Test with real checkNumber from database
4. ⏳ Configure MIFOS webhook URL (if not already done)
5. ⏳ Test end-to-end flow with actual loan
6. ⏳ Monitor logs for any errors
7. ⏳ Update documentation with production results

## Support

For issues or questions:
- Check PM2 logs: `pm2 logs ess-api --lines 200`
- Check AuditLog collection for event tracking
- Check LoanMappings for pendingCallback data
- Verify MIFOS webhook configuration
- Test with test-loan-restructure-flow.js script

## Summary

✅ **Implemented:**
- LOAN_RESTRUCTURE_REQUEST handler with immediate ACK
- MIFOS reschedule API integration
- Webhook-based callback trigger
- LOAN_INITIAL_APPROVAL_NOTIFICATION sender
- Complete audit trail logging
- Error handling and recovery

✅ **Files Uploaded:**
- loanRestructureHandler.js (NEW)
- mifosWebhookHandler.js (UPDATED)
- apiController.js (UPDATED)

⏳ **Pending:**
- PM2 restart (manual step required)
- End-to-end testing
- Production validation
