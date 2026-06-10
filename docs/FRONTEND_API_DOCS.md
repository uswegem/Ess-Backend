# Frontend API Documentation

## Base URL
```
http://localhost:3002/api/frontend
```

## Authentication
All endpoints require authentication. Include JWT token or session cookie in requests.

## Response Format
All endpoints return JSON in the following format:

```json
{
  "success": true/false,
  "data": { ... },  // Present on success
  "code": "error_code",  // Present on error
  "message": "Error message",  // Present on error
  "error": "Detailed error"  // Present on error
}
```

---

## Endpoints

### 1. Health Check
**GET** `/api/frontend/health`

Check if the API is running.

**Response:**
```json
{
  "success": true,
  "service": "Frontend API",
  "status": "healthy",
  "timestamp": "2025-12-19T10:00:00.000Z"
}
```

---

### 2. Check Loan Eligibility
**POST** `/api/frontend/loan/check-eligibility`

Check if a customer is eligible for a new loan.

**Request Body:**
```json
{
  "nin": "19900101-12345-67890-12",
  "mobileNumber": "255712345678"
}
```

**Response (Eligible):**
```json
{
  "success": true,
  "data": {
    "eligible": true,
    "clientExists": false,
    "message": "New customer - eligible for loan application"
  }
}
```

**Response (Has Active Loans):**
```json
{
  "success": true,
  "data": {
    "eligible": false,
    "clientExists": true,
    "clientId": 123,
    "activeLoans": 2,
    "message": "Customer has active loans"
  }
}
```

---

### 3. Submit Loan Application
**POST** `/api/frontend/loan/apply`

Submit a new loan application.

**Request Body:**
```json
{
  "firstName": "John",
  "middleName": "Peter",
  "lastName": "Doe",
  "sex": "M",
  "nin": "19900101-12345-67890-12",
  "mobileNumber": "255712345678",
  "dateOfBirth": "1990-01-01",
  "maritalStatus": "Single",
  "bankAccountNumber": "0152562001300",
  "swiftCode": "NMIBTZTZ",
  "emailAddress": "john.doe@example.com",
  
  "productCode": "WWL",
  "requestedAmount": 5000000,
  "tenure": 24,
  "purpose": "Business expansion",
  
  "employerName": "Government of Tanzania",
  "employerCheckNumber": "EMP12345",
  "netSalary": 1500000,
  "grossSalary": 2000000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "applicationNumber": "APP1734563284567",
    "status": "PENDING",
    "message": "Loan application submitted successfully"
  }
}
```

---

### 4. Get Application Status
**GET** `/api/frontend/loan/status/:applicationNumber`

Get the status of a loan application.

**Response (Pending):**
```json
{
  "success": true,
  "data": {
    "applicationNumber": "APP1734563284567",
    "status": "PENDING",
    "message": "Application is being processed"
  }
}
```

**Response (Approved/Disbursed):**
```json
{
  "success": true,
  "data": {
    "applicationNumber": "APP1734563284567",
    "loanNumber": "ESS1734563284567",
    "status": "Active",
    "principal": 5000000,
    "approvedAmount": 5000000,
    "disbursedAmount": 5000000,
    "outstandingBalance": 4200000,
    "nextPaymentDate": [2026, 1, 15],
    "nextPaymentAmount": 250000
  }
}
```

---

### 5. Get Loan Details
**GET** `/api/frontend/loan/details/:loanNumber`

Get detailed information about a loan including repayment schedule.

**Response:**
```json
{
  "success": true,
  "data": {
    "loanNumber": "ESS1734563284567",
    "accountNumber": "000000031",
    "status": "Active",
    "principal": 5000000,
    "approvedAmount": 5000000,
    "disbursedAmount": 5000000,
    "disbursementDate": [2025, 11, 15],
    "principalOutstanding": 4200000,
    "interestOutstanding": 150000,
    "feesOutstanding": 0,
    "penaltiesOutstanding": 0,
    "totalOutstanding": 4350000,
    "totalPaid": 800000,
    "interestRate": 24,
    "numberOfRepayments": 24,
    "maturityDate": [2027, 11, 15],
    "schedule": [
      {
        "period": 1,
        "dueDate": [2025, 12, 15],
        "principalDue": 180000,
        "interestDue": 100000,
        "feesDue": 0,
        "penaltiesDue": 0,
        "totalDue": 280000,
        "totalPaid": 280000,
        "completed": true
      },
      {
        "period": 2,
        "dueDate": [2026, 1, 15],
        "principalDue": 185000,
        "interestDue": 95000,
        "feesDue": 0,
        "penaltiesDue": 0,
        "totalDue": 280000,
        "totalPaid": 0,
        "completed": false
      }
    ],
    "transactions": [
      {
        "id": 45,
        "date": [2025, 12, 15],
        "type": "Repayment",
        "amount": 280000,
        "principalPortion": 180000,
        "interestPortion": 100000,
        "feesPortion": 0,
        "penaltiesPortion": 0,
        "outstandingBalance": 4820000
      }
    ]
  }
}
```

---

### 6. Get Customer Loans
**GET** `/api/frontend/customer/loans/:nin`

Get all loans for a specific customer.

**Response:**
```json
{
  "success": true,
  "data": {
    "customerName": "John Doe",
    "nin": "19900101-12345-67890-12",
    "totalLoans": 2,
    "loans": [
      {
        "loanId": 31,
        "accountNumber": "000000031",
        "externalId": "ESS1734563284567",
        "status": "Active",
        "productName": "Watumishi Wezesha Loan",
        "principal": 5000000,
        "loanBalance": 4350000
      },
      {
        "loanId": 45,
        "accountNumber": "000000045",
        "externalId": "ESS1734567890123",
        "status": "Closed",
        "productName": "Watumishi Wezesha Loan",
        "principal": 3000000,
        "loanBalance": 0
      }
    ]
  }
}
```

---

### 7. Calculate Loan Schedule
**POST** `/api/frontend/loan/calculate-schedule`

Calculate a loan repayment schedule without creating the loan.

**Request Body:**
```json
{
  "amount": 5000000,
  "tenure": 24,
  "interestRate": 24
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "loanAmount": 5000000,
    "tenure": 24,
    "interestRate": 24,
    "monthlyPayment": 263571.43,
    "totalInterest": 1325714.32,
    "totalRepayment": 6325714.32,
    "schedule": [
      {
        "period": 1,
        "principalDue": 163571.43,
        "interestDue": 100000,
        "totalDue": 263571.43,
        "outstandingBalance": 4836428.57
      },
      {
        "period": 2,
        "principalDue": 166842.86,
        "interestDue": 96728.57,
        "totalDue": 263571.43,
        "outstandingBalance": 4669585.71
      }
    ]
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "code": "400",
  "message": "Missing required fields"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "code": "401",
  "message": "Unauthorized",
  "error": "Invalid or missing authentication token"
}
```

### 404 Not Found
```json
{
  "success": false,
  "code": "404",
  "message": "Application not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "code": "500",
  "message": "Error processing request",
  "error": "Detailed error message"
}
```

---

## React Integration Example

### Using Axios

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002/api/frontend';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Check eligibility
export const checkEligibility = async (nin, mobileNumber) => {
  const response = await api.post('/loan/check-eligibility', {
    nin,
    mobileNumber
  });
  return response.data;
};

// Submit loan application
export const applyForLoan = async (applicationData) => {
  const response = await api.post('/loan/apply', applicationData);
  return response.data;
};

// Get loan status
export const getLoanStatus = async (applicationNumber) => {
  const response = await api.get(`/loan/status/${applicationNumber}`);
  return response.data;
};

// Get loan details
export const getLoanDetails = async (loanNumber) => {
  const response = await api.get(`/loan/details/${loanNumber}`);
  return response.data;
};

// Get customer loans
export const getCustomerLoans = async (nin) => {
  const response = await api.get(`/customer/loans/${nin}`);
  return response.data;
};

// Calculate schedule
export const calculateSchedule = async (amount, tenure, interestRate = 24) => {
  const response = await api.post('/loan/calculate-schedule', {
    amount,
    tenure,
    interestRate
  });
  return response.data;
};
```

### Using in React Component

```javascript
import React, { useState } from 'react';
import { applyForLoan } from './api';

function LoanApplicationForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nin: '',
    mobileNumber: '',
    requestedAmount: '',
    tenure: 24
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await applyForLoan(formData);
      
      if (response.success) {
        setResult({
          type: 'success',
          message: `Application submitted! Reference: ${response.data.applicationNumber}`
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: error.response?.data?.message || 'Application failed'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Apply for Loan'}
      </button>
      
      {result && (
        <div className={`alert alert-${result.type}`}>
          {result.message}
        </div>
      )}
    </form>
  );
}
```

---

## Testing with curl

```bash
# Check eligibility
curl -X POST http://localhost:3002/api/frontend/loan/check-eligibility \
  -H "Content-Type: application/json" \
  -d '{"nin":"19900101-12345-67890-12","mobileNumber":"255712345678"}'

# Submit application
curl -X POST http://localhost:3002/api/frontend/loan/apply \
  -H "Content-Type: application/json" \
  -d '{
    "firstName":"John",
    "lastName":"Doe",
    "nin":"19900101-12345-67890-12",
    "mobileNumber":"255712345678",
    "requestedAmount":5000000,
    "tenure":24
  }'

# Get loan status
curl http://localhost:3002/api/frontend/loan/status/APP1734563284567

# Calculate schedule
curl -X POST http://localhost:3002/api/frontend/loan/calculate-schedule \
  -H "Content-Type: application/json" \
  -d '{"amount":5000000,"tenure":24,"interestRate":24}'
```

---

## Notes

1. **Authentication**: Currently using a basic validation middleware. Implement JWT or session-based auth as needed.

2. **CORS**: Configure CORS in server.js to allow your React app domain.

3. **Rate Limiting**: Consider adding rate limiting for production.

4. **Validation**: Add more comprehensive input validation as needed.

5. **Error Handling**: Implement consistent error handling across all endpoints.

6. **Logging**: All requests are logged for debugging and monitoring.

7. **Testing**: Test all endpoints before deploying to production.
