# MiraCore ESS API - Postman Collection

This Postman collection contains all **incoming message types** from ESS_UTUMISHI to ZE DONE for testing the MiraCore API.

## 📋 Collection Overview

**Total Requests:** 20 message types

### Message Types Included:
- RESPONSE
- ACCOUNT_VALIDATION
- DEDUCTION_STOP_NOTIFICATION
- DEFAULTER_DETAILS_TO_FSP
- FSP_MONTHLY_DEDUCTIONS
- FSP_REPAYMENT_REQUEST
- LOAN_CANCELLATION_NOTIFICATION
- LOAN_CHARGES_REQUEST
- LOAN_OFFER_REQUEST
- LOAN_FINAL_APPROVAL_NOTIFICATION
- LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST
- LOAN_RESTRUCTURE_REJECTION
- LOAN_RESTRUCTURE_REQUEST
- LOAN_TAKEOVER_OFFER_REQUEST
- PARTIAL_LOAN_REPAYMENT_REQUEST
- REPAYMENT_0FF_BALANCE_REQUEST_TO_FSP
- TAKEOVER_PAY_OFF_BALANCE_REQUEST
- TAKEOVER_PAYMENT_NOTIFICATION
- TOP_UP_OFFER_REQUEST
- TOP_UP_PAY_0FF_BALANCE_REQUEST

## 🚀 Quick Start

### 1. Import Collection
1. Open Postman
2. Click **Import** button
3. Select **File**
4. Choose `MiraCore_ESS_Incoming_Messages.postman_collection.json`

### 2. Configure Environment Variables
Create a new environment in Postman with these variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `base_url` | `http://localhost:3002` | Your MiraCore API base URL |
| `fsp_code` | `FL8090` | FSP Code for ZE DONE |

### 3. Start Testing
- Select any request from the collection
- Click **Send** to test the API
- View response in the response panel

## 📝 Request Structure

All requests follow the standard ESS XML format:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>UNIQUE_MESSAGE_ID</MsgId>
            <MessageType>MESSAGE_TYPE</MessageType>
        </Header>
        <MessageDetails>
            <!-- Message-specific fields -->
        </MessageDetails>
    </Data>
</Document>
```

## 🔧 Customization

### Dynamic Values
The collection uses Postman variables for dynamic content:
- `{{timestamp}}` - Current timestamp for unique IDs
- `{{fsp_code}}` - Configurable FSP code
- `{{base_url}}` - API base URL

### Modifying Request Data
1. Select a request
2. Go to **Body** tab
3. Edit the XML content as needed
4. Click **Send**

## 📊 Testing Scenarios

### Loan Flow Testing
1. **LOAN_CHARGES_REQUEST** - Calculate loan charges
2. **LOAN_OFFER_REQUEST** - Get loan offer
3. **LOAN_FINAL_APPROVAL_NOTIFICATION** - Create client & loan

### Maintenance Operations
- **ACCOUNT_VALIDATION** - Validate bank accounts
- **DEDUCTION_STOP_NOTIFICATION** - Stop deductions
- **FSP_REPAYMENT_REQUEST** - Process repayments

### Special Cases
- **LOAN_CANCELLATION_NOTIFICATION** - Cancel loans
- **LOAN_RESTRUCTURE_REQUEST** - Restructure loans
- **TOP_UP_OFFER_REQUEST** - Top-up existing loans

## 🔍 Response Analysis

### Success Response
```xml
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <MsgId>RESPONSE_ID</MsgId>
            <MessageType>RESPONSE</MessageType>
        </Header>
        <MessageDetails>
            <ResponseCode>0000</ResponseCode>
            <Description>Success</Description>
        </MessageDetails>
    </Data>
    <Signature>...</Signature>
</Document>
```

### Error Response
```xml
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <MsgId>ERROR_ID</MsgId>
            <MessageType>RESPONSE</MessageType>
        </Header>
        <MessageDetails>
            <ResponseCode>8014</ResponseCode>
            <Description>Error description</Description>
        </MessageDetails>
    </Data>
    <Signature>...</Signature>
</Document>
```

## 🐛 Troubleshooting

### Common Issues
1. **Connection Refused** - Check if MiraCore server is running
2. **400 Bad Request** - Verify XML format and required fields
3. **500 Internal Error** - Check server logs for details

### Server Logs
Check server logs for detailed error information:
```bash
# On your server
cd /home/uswege/ess
pm2 logs ess-app
```

## 📞 Support

For issues with:
- **API responses** - Check server logs
- **XML format** - Refer to existing test files
- **Business logic** - Review controller implementations

## 🔄 Updates

When the API changes:
1. Update the XML payloads in the collection
2. Add new message types as needed
3. Test all requests after deployment

---

**File:** `MiraCore_ESS_Incoming_Messages.postman_collection.json`
**Version:** 1.0
**Last Updated:** October 27, 2025