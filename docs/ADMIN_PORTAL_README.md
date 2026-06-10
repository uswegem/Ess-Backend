# Admin Portal - Message Management System

This document describes the implementation of an admin portal that allows manual re-sending of outgoing message types in the ESS (Electronic Salary System) application.

## Overview

The admin portal provides administrators with the ability to:
- View all outgoing message history
- Filter messages by type, status, date range, and application number
- View detailed message information including XML payloads and responses
- Manually resend failed or previously sent messages
- Monitor message statistics and success rates

## Backend Implementation

### New Components Added

1. **MessageLog Model** (`src/models/MessageLog.js`)
   - Stores all outgoing and incoming messages
   - Tracks message status, retry counts, and metadata
   - Supports 25+ predefined outgoing message types

2. **Message Controller** (`src/controllers/messageController.js`)
   - `getMessageLogs()` - Retrieve paginated message history with filtering
   - `getMessageStats()` - Get message statistics for the last 30 days
   - `resendMessage()` - Manually resend a message with new signature
   - `getMessageById()` - Get detailed information for a specific message
   - `getMessageTypes()` - Get list of all supported message types

3. **Message Routes** (`src/routes/messages.js`)
   - `/api/v1/messages/logs` - GET message history
   - `/api/v1/messages/stats` - GET message statistics
   - `/api/v1/messages/types` - GET available message types
   - `/api/v1/messages/:messageId` - GET specific message details
   - `/api/v1/messages/:messageId/resend` - POST resend message

4. **Message Logging Utility** (`src/utils/messageLogger.js`)
   - `logOutgoingMessage()` - Log outgoing messages to database
   - `updateMessageLog()` - Update message status after sending
   - `logIncomingMessage()` - Log incoming messages (for future use)

5. **Updated Third Party Service** (`src/services/thirdPartyService.js`)
   - Now logs all outgoing messages automatically
   - Updates message status based on send results
   - Supports metadata passing for better tracking

## Frontend Implementation

### React Components

1. **MessageManagement** (`frontend/src/components/admin/MessageManagement.js`)
   - Main admin portal component
   - Displays message history table with filtering
   - Handles message resending with confirmation dialogs
   - Shows message statistics overview

2. **MessageDetailsModal** (`frontend/src/components/admin/MessageDetailsModal.js`)
   - Detailed message viewer with tabbed interface
   - Shows overview, request XML, response, and metadata
   - Allows copying and downloading of XML content

3. **MessageStats** (`frontend/src/components/admin/MessageStats.js`)
   - Dashboard-style statistics cards
   - Shows total messages, success rates, failures, and resends

## Supported Message Types

The system supports the following outgoing message types:

- RESPONSE
- ACCOUNT_VALIDATION_RESPONSE
- DEFAULTER_DETAILS_TO_EMPLOYER
- FSP_BRANCHES
- FULL_LOAN_REPAYMENT_NOTIFICATION
- FULL_LOAN_REPAYMENT_REQUEST
- LOAN_CHARGES_RESPONSE
- LOAN_DISBURSEMENT_FAILURE_NOTIFICATION
- LOAN_DISBURSEMENT_NOTIFICATION
- LOAN_INITIAL_APPROVAL_NOTIFICATION
- LOAN_LIQUIDATION_NOTIFICATION
- LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE
- LOAN_RESTRUCTURE_BALANCE_REQUEST
- LOAN_RESTRUCTURE_BALANCE_RESPONSE
- LOAN_RESTRUCTURE_REQUEST_FSP
- LOAN_STATUS_REQUEST
- LOAN_TAKEOVER_BALANCE_RESPONSE
- LOAN_TOP_UP_BALANCE_RESPONSE
- PARTIAL_LOAN_REPAYMENT_NOTIFICATION
- PARTIAL_REPAYMENT_OFF_BALANCE_RESPONSE
- PAYMENT_ACKNOWLEDGMENT_NOTIFICATION
- PRODUCT_DECOMMISSION
- PRODUCT_DETAIL
- TAKEOVER_DISBURSEMENT_NOTIFICATION

## API Endpoints

### Authentication Required
All endpoints require JWT authentication and admin/super_admin role.

### GET /api/v1/messages/logs
Retrieve message history with optional filtering.

**Query Parameters:**
- `messageType` - Filter by message type
- `status` - Filter by status (sent, failed, pending, resent)
- `applicationNumber` - Filter by application number
- `loanNumber` - Filter by loan number
- `startDate` - Filter from date (YYYY-MM-DD)
- `endDate` - Filter to date (YYYY-MM-DD)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

### GET /api/v1/messages/stats
Get message statistics for the last 30 days.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "_id": "LOAN_CHARGES_RESPONSE",
        "count": 45,
        "sent": 42,
        "failed": 3,
        "resent": 2
      }
    ],
    "totalMessages": 150,
    "period": "30 days"
  }
}
```

### POST /api/v1/messages/:messageId/resend
Resend a specific message.

**Response:**
```json
{
  "success": true,
  "message": "Message resent successfully.",
  "data": {
    "originalMessageId": "LCR_001234",
    "newMessageId": "LCR_001234_resent_1234567890",
    "response": "..."
  }
}
```

## Database Schema

### MessageLog Collection
```javascript
{
  messageId: String (unique),
  messageType: String (enum),
  direction: String (outgoing/incoming),
  status: String (sent/failed/pending/resent),
  xmlPayload: String,
  response: String,
  errorMessage: String,
  applicationNumber: String,
  loanNumber: String,
  fspReferenceNumber: String,
  sender: String,
  receiver: String,
  sentBy: ObjectId (ref: User),
  sentAt: Date,
  resentAt: Date,
  retryCount: Number,
  metadata: Mixed,
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations

- All message management endpoints require admin authentication
- XML payloads are stored encrypted in the database
- Message resending creates new message records with fresh signatures
- Audit logs track all admin actions

## Usage Instructions

1. **Access Admin Portal**: Navigate to the admin section of your React application
2. **View Messages**: Use filters to find specific messages by type, status, or application
3. **View Details**: Click the eye icon to see full message details including XML
4. **Resend Messages**: Click the send icon on failed or sent messages to resend them
5. **Monitor Statistics**: Check the stats cards for overall system health

## Future Enhancements

- Bulk message resending
- Scheduled message retries
- Message templates for common scenarios
- Advanced filtering and search capabilities
- Message queue management
- Real-time message status updates