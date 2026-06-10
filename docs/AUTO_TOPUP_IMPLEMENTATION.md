# Auto Top-Up Implementation for LOAN_INITIAL_APPROVAL_NOTIFICATION

## Current System Analysis

### 1. LOAN_OFFER_REQUEST Flow
Location: `src/controllers/handlers/loanOfferHandler.js`

**Current Process:**
1. Receives LOAN_OFFER_REQUEST from ESS
2. Stores client/loan/employment data
3. Sends immediate ACK response (8000)
4. After 20 seconds, sends LOAN_INITIAL_APPROVAL_NOTIFICATION callback

**Key Functions:**
- Stores data using `LoanMappingService.createOrUpdateWithClientData()`
- Calculates loan offer based on affordability
- Sends callback using `sendCallback(approvalResponseData)`

### 2. Active Loan Detection

**Available Functions in `src/services/loanService.js`:**

```javascript
// Search client by NIN
async function searchClientByExternalId(externalId) {
    const response = await api.get(`/v1/clients?externalId=${externalId}`);
    if (response.status && response.response && response.response.length > 0) {
        return response.response[0]; // Returns { id, accountNo, ... }
    }
    return null;
}

// Get all loans for a client
async function getClientLoans(clientId) {
    const response = await api.get(`/v1/clients/${clientId}/accounts`);
    if (response.status && response.response && response.response.loanAccounts) {
        return response.response.loanAccounts;
    }
    return [];
}

// Filter active loans (status.id === 300)
const activeLoans = existingLoans.filter(loan => loan.status.id === 300);
```

### 3. Top-Up Request Handling

**Location:** `src/controllers/apiController.js` lines 426-591

**Current TOP_UP_OFFER_REQUEST Process:**
1. Stores client/loan/employment data
2. Sends immediate ACK
3. After 20 seconds, sends LOAN_INITIAL_APPROVAL_NOTIFICATION
4. Uses similar calculation logic as regular loan offer

### 4. Client Service

**Location:** `src/services/clientService.js`

```javascript
static async searchClientByExternalId(externalId) {
    // Searches MIFOS CBS for client by NIN
}
```

## Implementation Strategy

### Option 1: Automatic Top-Up Detection (Recommended)

**Modify:** `src/controllers/handlers/loanOfferHandler.js`

**Logic:**
```
WHEN LOAN_OFFER_REQUEST received:
1. Extract customer NIN
2. Search for existing client in CBS
3. IF client exists:
   a. Get all loans for client
   b. Filter active loans (status.id === 300)
   c. IF active loans exist:
      - Treat as TOP_UP_OFFER_REQUEST automatically
      - Calculate top-up amount
      - Send LOAN_INITIAL_APPROVAL_NOTIFICATION with top-up details
   d. ELSE:
      - Process as normal loan offer
4. ELSE:
   - Process as normal loan offer (new customer)
```

### Option 2: Separate Endpoint (Alternative)

Create a utility function that can be called from LOAN_OFFER_REQUEST handler to check for active loans and route accordingly.

## Proposed Code Changes

### File: `src/controllers/handlers/loanOfferHandler.js`

**Add imports:**
```javascript
const ClientService = require('../../services/clientService');
const { searchClientByExternalId, getClientLoans } = require('../../services/loanService');
```

**Add function before handleLoanOfferRequest:**
```javascript
/**
 * Check if customer has active loans in CBS
 * @param {string} nin - Customer NIN
 * @returns {Object|null} - Active loan details or null
 */
async function checkForActiveLoans(nin) {
    try {
        logger.info('🔍 Checking for active loans for NIN:', nin);
        
        // Search for customer in CBS by NIN
        const customer = await searchClientByExternalId(nin);
        
        if (!customer) {
            logger.info('✅ No existing customer found in CBS');
            return null;
        }
        
        logger.info('📋 Customer found in CBS:', {
            id: customer.id,
            accountNo: customer.accountNo,
            name: customer.displayName
        });
        
        // Get all loans for customer
        const loans = await getClientLoans(customer.id);
        
        if (!loans || loans.length === 0) {
            logger.info('✅ No loans found for customer');
            return null;
        }
        
        // Filter active loans (status.id === 300 means Active)
        const activeLoans = loans.filter(loan => loan.status && loan.status.id === 300);
        
        if (activeLoans.length === 0) {
            logger.info('✅ No active loans found (may have closed loans)');
            return null;
        }
        
        logger.info('⚠️ Active loan(s) detected:', {
            count: activeLoans.length,
            loans: activeLoans.map(l => ({
                id: l.id,
                accountNo: l.accountNo,
                principal: l.principal,
                status: l.status.value
            }))
        });
        
        // Return first active loan (system supports 1 loan per customer)
        return {
            customer: customer,
            activeLoan: activeLoans[0],
            activeLoansCount: activeLoans.length
        };
        
    } catch (error) {
        logger.error('❌ Error checking for active loans:', error);
        return null; // On error, proceed as normal loan
    }
}
```

**Modify handleLoanOfferRequest logic:**

After extracting client data (around line 50), add:

```javascript
// Check for active loans before processing
const activeLoanInfo = await checkForActiveLoans(clientData.nin);

if (activeLoanInfo) {
    logger.info('🔄 Customer has active loan - automatically treating as TOP-UP request');
    
    // Process as top-up offer request
    return await handleTopUpOfferRequestAuto(
        parsedData, 
        res, 
        clientData, 
        loanData, 
        employmentData,
        activeLoanInfo
    );
}

// Continue with normal loan offer processing...
```

**Add new function for automatic top-up handling:**
```javascript
/**
 * Handle automatic top-up when active loan is detected
 */
async function handleTopUpOfferRequestAuto(parsedData, res, clientData, loanData, employmentData, activeLoanInfo) {
    try {
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;
        
        logger.info('📊 Processing automatic TOP-UP with active loan:', {
            activeLoanId: activeLoanInfo.activeLoan.id,
            activeLoanAccount: activeLoanInfo.activeLoan.accountNo,
            activeLoanPrincipal: activeLoanInfo.activeLoan.principal
        });
        
        // Update loan data with top-up info
        loanData.productCode = 'TOPUP';
        loanData.existingLoanNumber = activeLoanInfo.activeLoan.accountNo;
        
        // Store data with top-up flag
        await LoanMappingService.createOrUpdateWithClientData(
            messageDetails.ApplicationNumber,
            messageDetails.CheckNumber,
            clientData,
            loanData,
            employmentData
        );
        
        // Send immediate ACK
        const ackResponseData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": "ESS_UTUMISHI",
                    "FSPCode": header.FSPCode,
                    "MsgId": getMessageId("RESPONSE"),
                    "MessageType": "RESPONSE"
                },
                MessageDetails: {
                    "ResponseCode": "8000",
                    "Description": "Success - Top-up detected"
                }
            }
        };
        
        const ackSignedResponse = digitalSignature.createSignedXML(ackResponseData.Data);
        res.status(200).send(ackSignedResponse);
        logger.info('✅ Sent ACK for auto-detected top-up');
        
        // Schedule LOAN_INITIAL_APPROVAL_NOTIFICATION callback
        setTimeout(async () => {
            try {
                const loanAmount = parseFloat(messageDetails.RequestedAmount) || LOAN_CONSTANTS.MIN_LOAN_AMOUNT;
                const interestRate = LOAN_CONSTANTS.DEFAULT_INTEREST_RATE;
                const tenure = parseInt(messageDetails.Tenure) || LOAN_CONSTANTS.MAX_TENURE;
                
                const totalInterestRateAmount = await LoanCalculations.calculateTotalInterest(loanAmount, interestRate, tenure);
                const charges = LoanCalculations.calculateCharges(loanAmount);
                const totalAmountToPay = loanAmount + totalInterestRateAmount;
                const otherCharges = charges.otherCharges;
                const loanNumber = generateLoanNumber();
                const fspReferenceNumber = generateFSPReferenceNumber();
                
                // Update loan mapping
                await LoanMappingService.createInitialMapping(
                    messageDetails.ApplicationNumber,
                    messageDetails.CheckNumber,
                    fspReferenceNumber,
                    {
                        essLoanNumberAlias: loanNumber,
                        productCode: "TOPUP",
                        requestedAmount: loanAmount,
                        totalAmountToPay: totalAmountToPay,
                        interestRate: interestRate,
                        tenure: tenure,
                        otherCharges: otherCharges,
                        status: 'INITIAL_APPROVAL_SENT',
                        mifosClientId: activeLoanInfo.customer.id,
                        existingLoanId: activeLoanInfo.activeLoan.id
                    }
                );
                
                const approvalResponseData = {
                    Header: {
                        "Sender": process.env.FSP_NAME || "ZE DONE",
                        "Receiver": "ESS_UTUMISHI",
                        "FSPCode": header.FSPCode,
                        "MsgId": getMessageId("LOAN_INITIAL_APPROVAL_NOTIFICATION"),
                        "MessageType": "LOAN_INITIAL_APPROVAL_NOTIFICATION"
                    },
                    MessageDetails: {
                        "ApplicationNumber": messageDetails.ApplicationNumber,
                        "Reason": "Top-Up Loan Request Approved (Auto-detected existing loan)",
                        "FSPReferenceNumber": fspReferenceNumber,
                        "LoanNumber": loanNumber,
                        "TotalAmountToPay": totalAmountToPay.toFixed(2),
                        "OtherCharges": otherCharges.toFixed(2),
                        "Approval": "APPROVED"
                    }
                };
                
                await sendCallback(approvalResponseData);
                logger.info('✅ Sent LOAN_INITIAL_APPROVAL_NOTIFICATION for auto-detected top-up');
                
            } catch (callbackError) {
                logger.error('❌ Error sending auto top-up callback:', callbackError);
            }
        }, 20000);
        
    } catch (error) {
        logger.error('❌ Error in auto top-up processing:', error);
        throw error;
    }
}
```

## Testing Strategy

### Test Case 1: New Customer (No Active Loan)
**Input:** LOAN_OFFER_REQUEST with new NIN
**Expected:** Normal loan offer processing
**Verify:** LOAN_INITIAL_APPROVAL_NOTIFICATION with regular loan

### Test Case 2: Existing Customer with Active Loan
**Input:** LOAN_OFFER_REQUEST with NIN that has active loan in CBS
**Expected:** Auto-detected as top-up
**Verify:** 
- Log shows "Customer has active loan - automatically treating as TOP-UP request"
- LOAN_INITIAL_APPROVAL_NOTIFICATION reason mentions "Top-Up" and "Auto-detected"
- Loan mapping has productCode = 'TOPUP'

### Test Case 3: Existing Customer with Closed Loan
**Input:** LOAN_OFFER_REQUEST with NIN that has only closed loans
**Expected:** Normal loan offer (treat as new loan)
**Verify:** LOAN_INITIAL_APPROVAL_NOTIFICATION with regular loan

## Benefits

1. **Automatic Detection:** No need for ESS to send different message types
2. **Seamless UX:** Customer experience unchanged regardless of loan type
3. **Data Integrity:** Proper tracking of top-up vs new loans
4. **Compliance:** Ensures proper loan processing rules
5. **No Breaking Changes:** Existing functionality remains intact

## Potential Issues & Solutions

**Issue 1:** CBS API call delays
**Solution:** Use timeout of 5 seconds, fallback to normal processing on failure

**Issue 2:** Multiple active loans (edge case)
**Solution:** Use first active loan, log warning if multiple found

**Issue 3:** Customer with loan in different system
**Solution:** Only checks CBS/MIFOS, relies on NIN as unique identifier

## Deployment Steps

1. Backup current loanOfferHandler.js
2. Add helper functions
3. Integrate active loan check
4. Test with sample requests
5. Monitor logs for "Customer has active loan" messages
6. Verify LOAN_INITIAL_APPROVAL_NOTIFICATION content

## Monitoring & Logs

Look for these log messages:
- `🔍 Checking for active loans for NIN:`
- `⚠️ Active loan(s) detected:`
- `🔄 Customer has active loan - automatically treating as TOP-UP request`
- `✅ Sent LOAN_INITIAL_APPROVAL_NOTIFICATION for auto-detected top-up`
