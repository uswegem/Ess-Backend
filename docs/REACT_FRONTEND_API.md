# React Frontend API Documentation

## Overview
The Frontend API provides a unified REST endpoint for the React application, similar to the Utumishi XML API but designed specifically for frontend consumption with JSON format.

**Base URL**: `http://135.181.33.13:3002/api/frontend`

## Key Features
- ✅ JSON request/response format (no XML)
- ✅ No digital signature requirements
- ✅ RESTful design
- ✅ All loan operations in one place
- ✅ Customer-centric endpoints
- ✅ Real-time data from Mifos CBS

## Authentication
All endpoints require authentication. Add authentication header to your requests:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

## Available Endpoints

### 1. Health Check
**GET** `/api/frontend/health`

Check if the API is running.

**Response**:
```json
{
  "success": true,
  "service": "Frontend API",
  "status": "healthy",
  "timestamp": "2025-12-19T19:45:30.123Z"
}
```

**cURL Example**:
```bash
curl http://135.181.33.13:3002/api/frontend/health
```

---

### 2. Check Loan Eligibility
**POST** `/api/frontend/loan/check-eligibility`

Check if a customer is eligible for a loan based on their NIN.

**Request Body**:
```json
{
  "nin": "12345678901234567890"
}
```

**Response** (Eligible):
```json
{
  "success": true,
  "eligible": true,
  "customer": {
    "nin": "12345678901234567890",
    "name": "John Doe",
    "mifosClientId": 123,
    "activeLoanCount": 0,
    "totalOutstanding": 0
  },
  "availableProducts": [
    {
      "productId": 17,
      "name": "Emergency Loan",
      "minAmount": 100000,
      "maxAmount": 5000000,
      "interestRate": 15.5,
      "termMonths": 12
    }
  ]
}
```

**Response** (Not Eligible):
```json
{
  "success": true,
  "eligible": false,
  "reason": "Customer has an active loan",
  "customer": {
    "nin": "12345678901234567890",
    "name": "Jane Smith",
    "activeLoanCount": 1
  }
}
```

**React Example**:
```javascript
const checkEligibility = async (nin) => {
  try {
    const response = await axios.post(
      'http://135.181.33.13:3002/api/frontend/loan/check-eligibility',
      { nin },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.eligible) {
      console.log('Customer is eligible!');
      console.log('Available products:', response.data.availableProducts);
    } else {
      console.log('Not eligible:', response.data.reason);
    }
  } catch (error) {
    console.error('Error checking eligibility:', error.response?.data);
  }
};
```

---

### 3. Submit Loan Application
**POST** `/api/frontend/loan/apply`

Submit a new loan application.

**Request Body**:
```json
{
  "nin": "12345678901234567890",
  "productId": 17,
  "principal": 1000000,
  "numberOfRepayments": 12,
  "repaymentFrequency": "MONTHS",
  "interestRate": 15.5,
  "purpose": "Business expansion"
}
```

**Response**:
```json
{
  "success": true,
  "applicationNumber": "ESS1734641130456",
  "status": "PENDING_APPROVAL",
  "message": "Loan application submitted successfully",
  "details": {
    "principal": 1000000,
    "interestRate": 15.5,
    "term": 12,
    "monthlyPayment": 90458.77,
    "totalRepayment": 1085505.24
  }
}
```

**React Example**:
```javascript
const applyForLoan = async (loanData) => {
  try {
    const response = await axios.post(
      'http://135.181.33.13:3002/api/frontend/loan/apply',
      {
        nin: loanData.nin,
        productId: 17,
        principal: loanData.amount,
        numberOfRepayments: loanData.months,
        repaymentFrequency: 'MONTHS',
        interestRate: 15.5,
        purpose: loanData.purpose
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Application Number:', response.data.applicationNumber);
    console.log('Monthly Payment:', response.data.details.monthlyPayment);
    return response.data.applicationNumber;
  } catch (error) {
    console.error('Error applying for loan:', error.response?.data);
    throw error;
  }
};
```

---

### 4. Check Application Status
**GET** `/api/frontend/loan/status/:applicationNumber`

Track the status of a loan application.

**Response**:
```json
{
  "success": true,
  "applicationNumber": "ESS1734641130456",
  "status": "APPROVED",
  "timeline": [
    {
      "stage": "SUBMITTED",
      "date": "2025-12-19T10:00:00Z",
      "user": "System"
    },
    {
      "stage": "APPROVED",
      "date": "2025-12-19T14:30:00Z",
      "user": "admin"
    }
  ],
  "nextAction": "awaiting_disbursement"
}
```

**React Example**:
```javascript
const checkStatus = async (appNumber) => {
  try {
    const response = await axios.get(
      `http://135.181.33.13:3002/api/frontend/loan/status/${appNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('Current Status:', response.data.status);
    console.log('Timeline:', response.data.timeline);
  } catch (error) {
    console.error('Error fetching status:', error.response?.data);
  }
};
```

---

### 5. Get Loan Details
**GET** `/api/frontend/loan/details/:loanNumber`

Get complete details of an active loan including repayment schedule and transaction history.

**Response**:
```json
{
  "success": true,
  "loan": {
    "loanNumber": "ESS1734641130456",
    "customerName": "John Doe",
    "nin": "12345678901234567890",
    "productName": "Emergency Loan",
    "principal": 1000000,
    "outstandingBalance": 750000,
    "status": "ACTIVE",
    "disbursementDate": "2025-12-19",
    "maturityDate": "2026-12-19",
    "interestRate": 15.5,
    "schedule": [
      {
        "installmentNumber": 1,
        "dueDate": "2026-01-19",
        "principal": 83333,
        "interest": 12500,
        "total": 95833,
        "paid": true
      },
      {
        "installmentNumber": 2,
        "dueDate": "2026-02-19",
        "principal": 83333,
        "interest": 11458,
        "total": 94791,
        "paid": false
      }
    ],
    "transactions": [
      {
        "date": "2026-01-19",
        "type": "REPAYMENT",
        "amount": 95833,
        "reference": "TXN123456"
      }
    ]
  }
}
```

**React Example**:
```javascript
const LoanDetails = ({ loanNumber }) => {
  const [loan, setLoan] = useState(null);
  
  useEffect(() => {
    const fetchLoan = async () => {
      try {
        const response = await axios.get(
          `http://135.181.33.13:3002/api/frontend/loan/details/${loanNumber}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        setLoan(response.data.loan);
      } catch (error) {
        console.error('Error fetching loan:', error);
      }
    };
    
    fetchLoan();
  }, [loanNumber]);
  
  if (!loan) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Loan {loan.loanNumber}</h2>
      <p>Outstanding: {loan.outstandingBalance.toLocaleString()}</p>
      <h3>Repayment Schedule</h3>
      {loan.schedule.map(installment => (
        <div key={installment.installmentNumber}>
          Due {installment.dueDate}: {installment.total} 
          {installment.paid && ' ✓ Paid'}
        </div>
      ))}
    </div>
  );
};
```

---

### 6. Get All Customer Loans
**GET** `/api/frontend/customer/loans/:nin`

Get all loans (active and closed) for a customer.

**Response**:
```json
{
  "success": true,
  "nin": "12345678901234567890",
  "customerName": "John Doe",
  "loans": [
    {
      "loanNumber": "ESS1734641130456",
      "productName": "Emergency Loan",
      "principal": 1000000,
      "outstandingBalance": 750000,
      "status": "ACTIVE",
      "disbursementDate": "2025-12-19"
    },
    {
      "loanNumber": "ESS1734000000123",
      "productName": "Emergency Loan",
      "principal": 500000,
      "outstandingBalance": 0,
      "status": "CLOSED",
      "disbursementDate": "2024-12-19",
      "closedDate": "2025-12-19"
    }
  ],
  "summary": {
    "totalLoans": 2,
    "activeLoans": 1,
    "closedLoans": 1,
    "totalOutstanding": 750000
  }
}
```

**React Example**:
```javascript
const CustomerLoans = ({ nin }) => {
  const [loans, setLoans] = useState([]);
  
  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const response = await axios.get(
          `http://135.181.33.13:3002/api/frontend/customer/loans/${nin}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        setLoans(response.data.loans);
      } catch (error) {
        console.error('Error fetching loans:', error);
      }
    };
    
    fetchLoans();
  }, [nin]);
  
  return (
    <div>
      <h2>Your Loans</h2>
      {loans.map(loan => (
        <div key={loan.loanNumber}>
          <h3>{loan.productName}</h3>
          <p>Amount: {loan.principal.toLocaleString()}</p>
          <p>Outstanding: {loan.outstandingBalance.toLocaleString()}</p>
          <p>Status: {loan.status}</p>
        </div>
      ))}
    </div>
  );
};
```

---

### 7. Calculate Loan Schedule
**POST** `/api/frontend/loan/calculate-schedule`

Calculate repayment schedule without submitting an application (loan calculator).

**Request Body**:
```json
{
  "principal": 1000000,
  "interestRate": 15.5,
  "numberOfRepayments": 12,
  "repaymentFrequency": "MONTHS"
}
```

**Response**:
```json
{
  "success": true,
  "calculation": {
    "principal": 1000000,
    "interestRate": 15.5,
    "term": 12,
    "monthlyPayment": 90458.77,
    "totalInterest": 85505.24,
    "totalRepayment": 1085505.24,
    "schedule": [
      {
        "month": 1,
        "payment": 90458.77,
        "principal": 77958.77,
        "interest": 12500,
        "balance": 922041.23
      },
      {
        "month": 2,
        "payment": 90458.77,
        "principal": 78956.02,
        "interest": 11502.75,
        "balance": 843085.21
      }
    ]
  }
}
```

**React Example (Loan Calculator)**:
```javascript
const LoanCalculator = () => {
  const [amount, setAmount] = useState(1000000);
  const [months, setMonths] = useState(12);
  const [calculation, setCalculation] = useState(null);
  
  const calculateLoan = async () => {
    try {
      const response = await axios.post(
        'http://135.181.33.13:3002/api/frontend/loan/calculate-schedule',
        {
          principal: amount,
          interestRate: 15.5,
          numberOfRepayments: months,
          repaymentFrequency: 'MONTHS'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setCalculation(response.data.calculation);
    } catch (error) {
      console.error('Error calculating:', error);
    }
  };
  
  return (
    <div>
      <h2>Loan Calculator</h2>
      <input 
        type="number" 
        value={amount} 
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Loan Amount"
      />
      <input 
        type="number" 
        value={months} 
        onChange={(e) => setMonths(e.target.value)}
        placeholder="Number of Months"
      />
      <button onClick={calculateLoan}>Calculate</button>
      
      {calculation && (
        <div>
          <h3>Results</h3>
          <p>Monthly Payment: {calculation.monthlyPayment.toLocaleString()}</p>
          <p>Total Interest: {calculation.totalInterest.toLocaleString()}</p>
          <p>Total Repayment: {calculation.totalRepayment.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
};
```

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message here",
  "details": "Additional error details if available"
}
```

**Common HTTP Status Codes**:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid authentication)
- `404` - Not Found (loan/customer not found)
- `500` - Server Error

**React Error Handling Example**:
```javascript
try {
  const response = await axios.post(url, data, config);
  // Handle success
} catch (error) {
  if (error.response) {
    // Server responded with error
    console.error('Error:', error.response.data.error);
    alert(error.response.data.error);
  } else if (error.request) {
    // No response received
    console.error('Network error');
    alert('Unable to connect to server');
  } else {
    // Other error
    console.error('Error:', error.message);
  }
}
```

---

## Complete React Integration Example

```javascript
// src/services/loanService.js
import axios from 'axios';

const API_BASE_URL = 'http://135.181.33.13:3002/api/frontend';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to all requests
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Loan Service
export const loanService = {
  // Check eligibility
  checkEligibility: async (nin) => {
    const response = await apiClient.post('/loan/check-eligibility', { nin });
    return response.data;
  },
  
  // Apply for loan
  applyForLoan: async (applicationData) => {
    const response = await apiClient.post('/loan/apply', applicationData);
    return response.data;
  },
  
  // Check application status
  checkStatus: async (applicationNumber) => {
    const response = await apiClient.get(`/loan/status/${applicationNumber}`);
    return response.data;
  },
  
  // Get loan details
  getLoanDetails: async (loanNumber) => {
    const response = await apiClient.get(`/loan/details/${loanNumber}`);
    return response.data;
  },
  
  // Get customer loans
  getCustomerLoans: async (nin) => {
    const response = await apiClient.get(`/customer/loans/${nin}`);
    return response.data;
  },
  
  // Calculate schedule
  calculateSchedule: async (calculationData) => {
    const response = await apiClient.post('/loan/calculate-schedule', calculationData);
    return response.data;
  },
  
  // Health check
  checkHealth: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  }
};

// Usage in React Component
import React, { useState } from 'react';
import { loanService } from './services/loanService';

function LoanApplication() {
  const [nin, setNin] = useState('');
  const [amount, setAmount] = useState(1000000);
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Check eligibility first
      const eligibility = await loanService.checkEligibility(nin);
      
      if (!eligibility.eligible) {
        alert(`Not eligible: ${eligibility.reason}`);
        return;
      }
      
      // Apply for loan
      const application = await loanService.applyForLoan({
        nin,
        productId: 17,
        principal: amount,
        numberOfRepayments: months,
        repaymentFrequency: 'MONTHS',
        interestRate: 15.5,
        purpose: 'Emergency needs'
      });
      
      setResult(application);
      alert(`Application submitted! Reference: ${application.applicationNumber}`);
      
    } catch (error) {
      console.error('Error:', error);
      alert(error.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="NIN"
        value={nin}
        onChange={(e) => setNin(e.target.value)}
        required
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <input
        type="number"
        placeholder="Months"
        value={months}
        onChange={(e) => setMonths(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Processing...' : 'Apply for Loan'}
      </button>
      
      {result && (
        <div>
          <h3>Success!</h3>
          <p>Application Number: {result.applicationNumber}</p>
          <p>Monthly Payment: {result.details.monthlyPayment.toLocaleString()}</p>
        </div>
      )}
    </form>
  );
}

export default LoanApplication;
```

---

## Comparison with Utumishi API

| Feature | Utumishi API | Frontend API |
|---------|--------------|--------------|
| **Format** | XML | JSON |
| **Signature** | Required (RSA) | Not required |
| **Base Path** | `/api` | `/api/frontend` |
| **Authentication** | Certificate-based | JWT/Session |
| **Use Case** | B2B integration | Frontend application |
| **Documentation** | XML Schema | REST API docs |

---

## Testing with cURL

```bash
# 1. Health check
curl http://135.181.33.13:3002/api/frontend/health

# 2. Check eligibility
curl -X POST http://135.181.33.13:3002/api/frontend/loan/check-eligibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"nin":"12345678901234567890"}'

# 3. Apply for loan
curl -X POST http://135.181.33.13:3002/api/frontend/loan/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "nin":"12345678901234567890",
    "productId":17,
    "principal":1000000,
    "numberOfRepayments":12,
    "repaymentFrequency":"MONTHS",
    "interestRate":15.5,
    "purpose":"Business expansion"
  }'

# 4. Check status
curl http://135.181.33.13:3002/api/frontend/loan/status/ESS1734641130456 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Get loan details
curl http://135.181.33.13:3002/api/frontend/loan/details/ESS1734641130456 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 6. Get customer loans
curl http://135.181.33.13:3002/api/frontend/customer/loans/12345678901234567890 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 7. Calculate schedule
curl -X POST http://135.181.33.13:3002/api/frontend/loan/calculate-schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "principal":1000000,
    "interestRate":15.5,
    "numberOfRepayments":12,
    "repaymentFrequency":"MONTHS"
  }'
```

---

## Security Considerations

1. **Authentication**: Implement JWT token validation in the `validateRequest` middleware
2. **CORS**: Configure CORS to allow only your React app domain
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **Input Validation**: All inputs are validated server-side
5. **HTTPS**: Use HTTPS in production (configure nginx/apache as reverse proxy)

---

## Next Steps

1. **Implement Authentication**:
   - Add JWT token generation on login
   - Update `validateRequest` middleware to verify tokens
   
2. **Add CORS Configuration**:
   ```javascript
   const cors = require('cors');
   app.use('/api/frontend', cors({
     origin: 'https://your-react-app.com',
     credentials: true
   }));
   ```

3. **Setup Rate Limiting**:
   ```javascript
   const rateLimit = require('express-rate-limit');
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });
   app.use('/api/frontend', limiter);
   ```

4. **Configure HTTPS**: Setup nginx reverse proxy with SSL certificate

---

## Support

For issues or questions about the Frontend API:
- Check the logs: `pm2 logs ess-app`
- Review Mifos CBS status: Check CBS connectivity
- Contact system administrator

**API Version**: 1.0  
**Last Updated**: December 19, 2025
