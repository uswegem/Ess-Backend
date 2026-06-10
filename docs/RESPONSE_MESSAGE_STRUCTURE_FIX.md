# RESPONSE Message Structure Fix - Summary

## Date: December 16, 2025

## Requirement
All messages with `MessageType: RESPONSE` must have the following standardized structure:

```xml
<Header>
    <Sender>ZE DONE</Sender>
    <Receiver>ESS_UTUMISHI</Receiver>
    <FSPCode>FL8090</FSPCode>
    <MsgId>ESS...</MsgId>
    <MessageType>RESPONSE</MessageType>
</Header>
<MessageDetails>
    <ResponseCode></ResponseCode>
    <Description></Description>
</MessageDetails>
```

## Issues Found and Fixed

### 1. **apiController.js - Line 561** (TAKEOVER_PAY_OFF_BALANCE_REQUEST)
**Before:**
```javascript
MessageDetails: {
    "Status": "SUCCESS",
    "StatusCode": "8000",
    "StatusDesc": "Request received and being processed"
}
```

**After:**
```javascript
MessageDetails: {
    "ResponseCode": "8000",
    "Description": "Request received and being processed"
}
```

### 2. **apiController.js - Line 741** (LOAN_TAKEOVER_OFFER_REQUEST)
**Before:**
```javascript
MessageDetails: {
    "Status": "SUCCESS",
    "StatusCode": "8000",
    "StatusDesc": "Request received and being processed"
}
```

**After:**
```javascript
MessageDetails: {
    "ResponseCode": "8000",
    "Description": "Request received and being processed"
}
```

### 3. **apiController.js - Line 837** (TAKEOVER_PAYMENT_NOTIFICATION)
**Before:**
```javascript
Header: {
    "Sender": process.env.FSP_NAME || "ZE DONE",
    "Receiver": "ESS_UTUMISHI",
    "FSPCode": header.FSPCode,
    "MessageType": "RESPONSE"  // Missing MsgId!
},
MessageDetails: {
    "Status": "SUCCESS",
    "StatusCode": "8000",
    "StatusDesc": "Request received and being processed"
}
```

**After:**
```javascript
Header: {
    "Sender": process.env.FSP_NAME || "ZE DONE",
    "Receiver": "ESS_UTUMISHI",
    "FSPCode": header.FSPCode,
    "MsgId": getMessageId("RESPONSE"),  // Added MsgId
    "MessageType": "RESPONSE"
},
MessageDetails: {
    "ResponseCode": "8000",
    "Description": "Request received and being processed"
}
```

### 4. **mifosWebhookHandler.js - Line 12** (Mifos Webhook)
**Before:**
```javascript
Header: {
    "Sender": process.env.FSP_NAME || "ZE DONE",
    "Receiver": "ESS_UTUMISHI",
    "MessageType": "RESPONSE"  // Missing FSPCode and MsgId!
},
MessageDetails: {
    "Status": "SUCCESS",
    "StatusCode": "8000",
    "StatusDesc": "Webhook received successfully"
}
```

**After:**
```javascript
Header: {
    "Sender": process.env.FSP_NAME || "ZE DONE",
    "Receiver": "ESS_UTUMISHI",
    "FSPCode": process.env.FSP_CODE || "FL8090",  // Added FSPCode
    "MsgId": generateMessageId(),  // Added MsgId
    "MessageType": "RESPONSE"
},
MessageDetails: {
    "ResponseCode": "8000",
    "Description": "Webhook received successfully"
}
```

### 5. **apiController.js - Line 1478** (LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST Error)
**Before:** Used `LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE` for errors

**After:**
```javascript
Header: {
    "MessageType": "RESPONSE"  // Changed from LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE
},
MessageDetails: {
    "ResponseCode": "8005",
    "Description": "Affordability calculation failed: " + error.message
}
```

## Already Correct Implementations

The following were already using the correct structure:
- ✅ sendErrorResponse utility function (responseUtils.js)
- ✅ LOAN_OFFER_REQUEST ACK response (line 189)
- ✅ TOP_UP_OFFER_REQUEST ACK response (line 436)
- ✅ LOAN_CANCELLATION_NOTIFICATION responses (lines 889, 988)
- ✅ LOAN_FINAL_APPROVAL_NOTIFICATION ACK response (line 1035)
- ✅ Error responses in handlers (loanChargesHandler.js, loanOfferHandler.js)

## Verification Tests

### Test 1: Success Responses
All 6 message types tested return correct RESPONSE structure:
- ✅ TOP_UP_OFFER_REQUEST
- ✅ LOAN_TAKEOVER_OFFER_REQUEST
- ✅ TAKEOVER_PAY_OFF_BALANCE_REQUEST
- ✅ TAKEOVER_PAYMENT_NOTIFICATION
- ✅ LOAN_FINAL_APPROVAL_NOTIFICATION
- ✅ LOAN_CANCELLATION_NOTIFICATION

### Test 2: Error Responses
All 3 error scenarios return correct RESPONSE structure:
- ✅ Malformed XML (ResponseCode: 8001)
- ✅ Invalid calculation data (ResponseCode: 8005)
- ✅ Missing required fields (ResponseCode: 8012)

## Files Modified

1. **src/controllers/apiController.js**
   - Fixed 4 RESPONSE message structures
   - Added missing MsgId in one location

2. **src/controllers/handlers/mifosWebhookHandler.js**
   - Fixed RESPONSE message structure
   - Added missing FSPCode and MsgId

## Deployment

- Files deployed to: 135.181.33.13:/home/uswege/ess/
- PM2 restarted: ✅ Both cluster instances online
- Status: **PRODUCTION READY**

## Impact

- **Breaking Change**: None (only standardization)
- **Backward Compatibility**: Maintained (clients already expecting ResponseCode/Description)
- **API Consistency**: Improved (all RESPONSE messages now follow same structure)
- **Integration**: Clients can now reliably parse all RESPONSE messages with consistent field names

## Notes

- All RESPONSE messages now include required fields: Sender, Receiver, FSPCode, MsgId, MessageType
- All MessageDetails now use: ResponseCode, Description (not Status/StatusCode/StatusDesc)
- Error responses correctly return MessageType: RESPONSE (not the original request's response type)
- Success responses use appropriate specific message types (e.g., LOAN_CHARGES_RESPONSE, LOAN_OFFER_RESPONSE)
