# Loan Disbursement Action Buttons - Implementation Guide

## ✅ **Implementation Complete!**

### **What Was Added:**

1. **Backend API Endpoints** (`/api/v1/loan-actions/`)
   - `POST /send-disbursement-notification` - Sends LOAN_DISBURSEMENT_NOTIFICATION
   - `POST /send-disbursement-failure` - Sends LOAN_DISBURSEMENT_FAILURE_NOTIFICATION

2. **Frontend UI Buttons**
   - Automatic buttons on loans with `LOAN_CREATED` status
   - Appears in both table rows and detail dialogs
   - Real-time status updates after sending notifications

---

## 🚀 **How to Activate the Buttons:**

### **Step 1: Open Admin Portal**
Navigate to: http://5.75.185.137/loans

### **Step 2: Apply the Button Script**
1. Press **F12** → **Console** tab
2. Copy and paste this **one-liner**:

```javascript
fetch('/add-disbursement-buttons.js').then(r=>r.text()).then(eval);
```

3. Press **Enter**

You should see:
```
✅ Disbursement action buttons added successfully!
📋 Buttons will appear for loans with LOAN_CREATED status
```

---

## 📋 **How It Works:**

### **When Buttons Appear:**
- Buttons **only** show for loans with status: `LOAN_CREATED`
- Two buttons are added:
  - **✅ Send Disbursement** (Green) - Success notification
  - **❌ Send Failure** (Red) - Failure notification

### **What Happens When You Click:**

#### **✅ Send Disbursement Button:**
1. Confirmation dialog appears
2. Sends `LOAN_DISBURSEMENT_NOTIFICATION` to ESS
3. Updates loan status to: `DISBURSED`
4. Page reloads to show updated status
5. Logs action with your username

#### **❌ Send Failure Button:**
1. Prompts for failure reason
2. Optionally prompts for error details
3. Sends `LOAN_DISBURSEMENT_FAILURE_NOTIFICATION` to ESS
4. Updates loan status to: `FAILED`
5. Page reloads to show updated status
6. Logs action with your username

---

## 🎯 **Where Buttons Appear:**

### **1. Loan List Table (Actions Column)**
```
┌─────────────────┬─────────────┬──────────────┬─────────────────────┐
│ Application No  │ Client Name │ Status       │ Actions             │
├─────────────────┼─────────────┼──────────────┼─────────────────────┤
│ APP_1234567890  │ John Doe    │ LOAN_CREATED │ [View]              │
│                 │             │              │ ✅ Send Disbursement│
│                 │             │              │ ❌ Send Failure     │
└─────────────────┴─────────────┴──────────────┴─────────────────────┘
```

### **2. Loan Detail Dialog**
When you click "View" on a `LOAN_CREATED` loan, a section appears:

```
┌────────────────────────────────────────────────┐
│ 💼 Disbursement Actions                        │
│ Loan is ready for disbursement.               │
│ Send notification to ESS:                      │
│                                                │
│ [✅ Send Disbursement Notification]            │
│ [❌ Send Failure Notification]                 │
└────────────────────────────────────────────────┘
```

---

## 🔧 **API Endpoints:**

### **1. Send Disbursement Notification**
```http
POST /api/v1/loan-actions/send-disbursement-notification
Authorization: Bearer <token>
Content-Type: application/json

{
  "applicationNumber": "APP_1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Disbursement notification sent successfully",
  "data": {
    "loanId": "12345",
    "applicationNumber": "APP_1234567890",
    "status": "DISBURSED",
    "result": { ... }
  }
}
```

### **2. Send Disbursement Failure**
```http
POST /api/v1/loan-actions/send-disbursement-failure
Authorization: Bearer <token>
Content-Type: application/json

{
  "applicationNumber": "APP_1234567890",
  "reason": "Insufficient funds",
  "errorDetails": "Account balance insufficient for disbursement"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Disbursement failure notification sent successfully",
  "data": {
    "loanId": "12345",
    "applicationNumber": "APP_1234567890",
    "status": "FAILED",
    "notification": "<?xml version='1.0'..."
  }
}
```

---

## 🔐 **Security & Permissions:**

- **Authentication Required**: Must be logged in with valid JWT token
- **Role Required**: `super_admin` or `admin` role only
- **Audit Trail**: All actions are logged with:
  - Username of person who triggered
  - Timestamp
  - Loan details
  - Notification result

---

## 📊 **Status Flow:**

```
LOAN_CREATED
    ├── ✅ Send Disbursement → DISBURSED
    └── ❌ Send Failure → FAILED
```

---

## 🧪 **Testing:**

### **Test Scenario 1: Success Flow**
1. Find a loan with `LOAN_CREATED` status
2. Click **✅ Send Disbursement**
3. Confirm the action
4. ✅ Status should change to `DISBURSED`

### **Test Scenario 2: Failure Flow**
1. Find a loan with `LOAN_CREATED` status
2. Click **❌ Send Failure**
3. Enter reason: "Test failure scenario"
4. Enter details: "Manual test"
5. ✅ Status should change to `FAILED`

### **Verify in Backend:**
```bash
# SSH to backend server
ssh uswege@135.181.33.13

# Check logs
pm2 logs ess-app | grep "Manual disbursement"
```

---

## 🐛 **Troubleshooting:**

### **Buttons Not Appearing:**
- ✅ Make sure you pasted the script in browser console
- ✅ Refresh the page
- ✅ Check loan status is exactly `LOAN_CREATED`

### **API Errors:**
- ✅ Check you're logged in
- ✅ Verify token in localStorage: `localStorage.getItem('token')`
- ✅ Check backend logs: `pm2 logs ess-app`

### **Nothing Happens When Clicking:**
- ✅ Open browser console (F12) and check for errors
- ✅ Verify API endpoint is accessible: http://5.75.185.137/api/v1/loan-actions/

---

## 📝 **Files Modified/Created:**

### **Backend:**
- ✅ `src/routes/loanActions.js` - New loan action endpoints
- ✅ `server.js` - Registered loan actions route

### **Frontend:**
- ✅ `add-disbursement-buttons.js` - Browser script to add UI buttons

### **Deployed To:**
- ✅ Backend: `135.181.33.13:/home/uswege/ess/`
- ✅ Frontend: `5.75.185.137:/var/www/html/admin/`

---

## 🎉 **Quick Start:**

**Copy this entire block and paste in browser console at http://5.75.185.137/loans:**

```javascript
fetch('/add-disbursement-buttons.js').then(r=>r.text()).then(eval);
```

That's it! Buttons will appear on all loans with `LOAN_CREATED` status.

---

## 📧 **Support:**

If you encounter any issues:
1. Check backend logs: `ssh uswege@135.181.33.13 "pm2 logs ess-app"`
2. Check browser console for JavaScript errors
3. Verify API endpoints are accessible: `curl http://5.75.185.137/api/v1/loan-actions/`

---

**Implementation Date:** December 15, 2025  
**Status:** ✅ Deployed and Ready to Use
