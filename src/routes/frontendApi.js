const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { formatDateForMifos, formatDateForUTUMISHI, formatDateTimeForUTUMISHI } = require('../utils/dateUtils');
const ClientService = require('../services/clientService');
const LoanMappingService = require('../services/loanMappingService');
const cbsApi = require('../services/cbs.api');

/**
 * Frontend API Routes
 * Base path: /api/frontend
 * 
 * All endpoints return JSON format
 * Authentication: JWT token or session-based
 */

// Middleware to validate request
const validateRequest = (req, res, next) => {
  try {
    // Add authentication validation here (JWT, session, etc.)
    // For now, just log the request
    logger.info('Frontend API request received:', {
      path: req.path,
      method: req.method,
      body: req.body
    });
    next();
  } catch (error) {
    logger.error('Request validation failed:', error);
    return res.status(401).json({
      success: false,
      code: '401',
      message: 'Unauthorized',
      error: error.message
    });
  }
};

// Apply middleware to all routes
router.use(validateRequest);

/**
 * POST /api/frontend/loan/check-eligibility
 * Check if customer is eligible for a loan
 */
router.post('/loan/check-eligibility', async (req, res) => {
  try {
    const { nin, mobileNumber } = req.body;

    if (!nin) {
      return res.status(400).json({
        success: false,
        code: '400',
        message: 'NIN is required'
      });
    }

    // Check if client exists in Mifos
    const existingClient = await ClientService.findClientByNIN(nin);

    if (existingClient) {
      // Get active loans
      const loansResponse = await cbsApi.maker.get(`/v1/clients/${existingClient.id}/accounts`);
      const activeLoans = loansResponse.data.loanAccounts?.filter(
        loan => loan.status?.active
      ) || [];

      return res.json({
        success: true,
        data: {
          eligible: activeLoans.length === 0,
          clientExists: true,
          clientId: existingClient.id,
          activeLoans: activeLoans.length,
          message: activeLoans.length > 0 
            ? 'Customer has active loans' 
            : 'Customer is eligible for a new loan'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        eligible: true,
        clientExists: false,
        message: 'New customer - eligible for loan application'
      }
    });

  } catch (error) {
    logger.error('Error checking eligibility:', error);
    return res.status(500).json({
      success: false,
      code: '500',
      message: 'Error checking eligibility',
      error: error.message
    });
  }
});

/**
 * POST /api/frontend/loan/apply
 * Submit a new loan application
 */
router.post('/loan/apply', async (req, res) => {
  try {
    const {
      // Customer details
      firstName,
      middleName,
      lastName,
      sex,
      nin,
      mobileNumber,
      dateOfBirth,
      maritalStatus,
      bankAccountNumber,
      swiftCode,
      emailAddress,
      
      // Loan details
      productCode,
      requestedAmount,
      tenure,
      purpose,
      
      // Additional info
      employerName,
      employerCheckNumber,
      netSalary,
      grossSalary
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !nin || !mobileNumber || !requestedAmount || !tenure) {
      return res.status(400).json({
        success: false,
        code: '400',
        message: 'Missing required fields'
      });
    }

    // Create application number
    const applicationNumber = `APP${Date.now()}`;

    // Store client data
    try {
      const clientData = {
        firstName,
        middleName,
        lastName,
        sex: sex || 'M',
        nin,
        mobileNo: mobileNumber,
        dateOfBirth,
        maritalStatus,
        bankAccountNumber,
        swiftCode,
        emailAddress
      };

      const loanData = {
        productCode: productCode || 'WWL',
        requestedAmount,
        tenure,
        purpose,
        employerName,
        employerCheckNumber,
        netSalary,
        grossSalary
      };

      await ClientService.storeClientData(applicationNumber, clientData, loanData);
      
      logger.info('Loan application stored:', {
        applicationNumber,
        nin,
        requestedAmount,
        tenure
      });

      return res.json({
        success: true,
        data: {
          applicationNumber,
          status: 'PENDING',
          message: 'Loan application submitted successfully'
        }
      });

    } catch (error) {
      logger.error('Error storing application:', error);
      return res.status(500).json({
        success: false,
        code: '500',
        message: 'Error submitting application',
        error: error.message
      });
    }

  } catch (error) {
    logger.error('Error processing loan application:', error);
    return res.status(500).json({
      success: false,
      code: '500',
      message: 'Error processing loan application',
      error: error.message
    });
  }
});

/**
 * GET /api/frontend/loan/status/:applicationNumber
 * Get loan application status
 */
router.get('/loan/status/:applicationNumber', async (req, res) => {
  try {
    const { applicationNumber } = req.params;

    // Find loan mapping
    const loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber, false);

    if (!loanMapping) {
      return res.status(404).json({
        success: false,
        code: '404',
        message: 'Application not found'
      });
    }

    // Get loan details from Mifos if loan was created
    if (loanMapping.mifosLoanId) {
      const loanResponse = await cbsApi.maker.get(`/v1/loans/${loanMapping.mifosLoanId}`);
      const loan = loanResponse.data;

      return res.json({
        success: true,
        data: {
          applicationNumber,
          loanNumber: loanMapping.essLoanNumberAlias,
          status: loan.status?.value || 'UNKNOWN',
          principal: loan.principal,
          approvedAmount: loan.approvedPrincipal,
          disbursedAmount: loan.summary?.principalDisbursed,
          outstandingBalance: loan.summary?.totalOutstanding,
          nextPaymentDate: loan.repaymentSchedule?.periods?.find(p => !p.complete)?.dueDate,
          nextPaymentAmount: loan.repaymentSchedule?.periods?.find(p => !p.complete)?.totalDueForPeriod
        }
      });
    }

    return res.json({
      success: true,
      data: {
        applicationNumber,
        status: loanMapping.status || 'PENDING',
        message: 'Application is being processed'
      }
    });

  } catch (error) {
    logger.error('Error fetching loan status:', error);
    return res.status(500).json({
      success: false,
      code: '500',
      message: 'Error fetching loan status',
      error: error.message
    });
  }
});

/**
 * GET /api/frontend/loan/details/:loanNumber
 * Get detailed loan information
 */
router.get('/loan/details/:loanNumber', async (req, res) => {
  try {
    const { loanNumber } = req.params;

    // Find loan by number
    const loanMapping = await LoanMappingService.getByEssLoanNumberAlias(loanNumber);

    if (!loanMapping || !loanMapping.mifosLoanId) {
      return res.status(404).json({
        success: false,
        code: '404',
        message: 'Loan not found'
      });
    }

    // Get loan details with repayment schedule
    const loanResponse = await cbsApi.maker.get(
      `/v1/loans/${loanMapping.mifosLoanId}?associations=repaymentSchedule,transactions`
    );
    const loan = loanResponse.data;

    // Format repayment schedule
    const schedule = loan.repaymentSchedule?.periods
      ?.filter(p => p.period)
      .map(period => ({
        period: period.period,
        dueDate: period.dueDate,
        principalDue: period.principalDue || period.principalOriginalDue,
        interestDue: period.interestDue || period.interestOriginalDue,
        feesDue: period.feeChargesDue || 0,
        penaltiesDue: period.penaltyChargesDue || 0,
        totalDue: period.totalDueForPeriod,
        totalPaid: period.totalPaidForPeriod,
        completed: period.complete
      })) || [];

    // Format transactions
    const transactions = loan.transactions
      ?.filter(t => !t.reversed)
      .map(txn => ({
        id: txn.id,
        date: txn.date,
        type: txn.type?.value,
        amount: txn.amount,
        principalPortion: txn.principalPortion,
        interestPortion: txn.interestPortion,
        feesPortion: txn.feeChargesPortion,
        penaltiesPortion: txn.penaltyChargesPortion,
        outstandingBalance: txn.outstandingLoanBalance
      })) || [];

    return res.json({
      success: true,
      data: {
        loanNumber,
        accountNumber: loan.accountNo,
        status: loan.status?.value,
        principal: loan.principal,
        approvedAmount: loan.approvedPrincipal,
        disbursedAmount: loan.summary?.principalDisbursed,
        disbursementDate: loan.timeline?.actualDisbursementDate,
        principalOutstanding: loan.summary?.principalOutstanding,
        interestOutstanding: loan.summary?.interestOutstanding,
        feesOutstanding: loan.summary?.feeChargesOutstanding,
        penaltiesOutstanding: loan.summary?.penaltyChargesOutstanding,
        totalOutstanding: loan.summary?.totalOutstanding,
        totalPaid: loan.summary?.totalRepayment,
        interestRate: loan.interestRatePerPeriod,
        numberOfRepayments: loan.numberOfRepayments,
        maturityDate: loan.timeline?.expectedMaturityDate,
        schedule,
        transactions
      }
    });

  } catch (error) {
    logger.error('Error fetching loan details:', error);
    return res.status(500).json({
      success: false,
      code: '500',
      message: 'Error fetching loan details',
      error: error.message
    });
  }
});

/**
 * GET /api/frontend/customer/loans/:nin
 * Get all loans for a customer by NIN
 */
router.get('/customer/loans/:nin', async (req, res) => {
  try {
    const { nin } = req.params;

    // Find client by NIN
    const client = await ClientService.findClientByNIN(nin);

    if (!client) {
      return res.status(404).json({
        success: false,
        code: '404',
        message: 'Customer not found'
      });
    }

    // Get all loans for client
    const loansResponse = await cbsApi.maker.get(`/v1/clients/${client.id}/accounts`);
    const loans = loansResponse.data.loanAccounts || [];

    const loanList = loans.map(loan => ({
      loanId: loan.id,
      accountNumber: loan.accountNo,
      externalId: loan.externalId,
      status: loan.status?.value,
      productName: loan.productName,
      principal: loan.originalLoan,
      loanBalance: loan.loanBalance
    }));

    return res.json({
      success: true,
      data: {
        customerName: `${client.firstname} ${client.lastname}`,
        nin,
        totalLoans: loanList.length,
        loans: loanList
      }
    });

  } catch (error) {
    logger.error('Error fetching customer loans:', error);
    return res.status(500).json({
      success: false,
      code: '500',
      message: 'Error fetching customer loans',
      error: error.message
    });
  }
});

/**
 * POST /api/frontend/loan/calculate-schedule
 * Calculate loan repayment schedule without creating a loan
 */
router.post('/loan/calculate-schedule', async (req, res) => {
  try {
    const { amount, tenure, interestRate } = req.body;

    if (!amount || !tenure) {
      return res.status(400).json({
        success: false,
        code: '400',
        message: 'Amount and tenure are required'
      });
    }

    const rate = interestRate || 24; // Default 24% if not provided
    const monthlyRate = rate / 12 / 100;
    const monthlyPayment = (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
                          (Math.pow(1 + monthlyRate, tenure) - 1);

    let balance = amount;
    const schedule = [];

    for (let i = 1; i <= tenure; i++) {
      const interest = balance * monthlyRate;
      const principal = monthlyPayment - interest;
      balance -= principal;

      schedule.push({
        period: i,
        principalDue: Math.round(principal * 100) / 100,
        interestDue: Math.round(interest * 100) / 100,
        totalDue: Math.round(monthlyPayment * 100) / 100,
        outstandingBalance: Math.round(Math.max(0, balance) * 100) / 100
      });
    }

    return res.json({
      success: true,
      data: {
        loanAmount: amount,
        tenure,
        interestRate: rate,
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        totalInterest: Math.round((monthlyPayment * tenure - amount) * 100) / 100,
        totalRepayment: Math.round(monthlyPayment * tenure * 100) / 100,
        schedule
      }
    });

  } catch (error) {
    logger.error('Error calculating schedule:', error);
    return res.status(500).json({
      success: false,
      code: '500',
      message: 'Error calculating schedule',
      error: error.message
    });
  }
});

/**
 * GET /api/frontend/loan/status-statistics
 * Get loan statistics grouped by status for Grafana tables
 */
router.get('/loan/status-statistics', async (req, res) => {
  try {
    const LoanMapping = require('../models/LoanMapping');

    // Get all loan mappings with status counts
    const statusStats = await LoanMapping.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          loans: {
            $push: {
              applicationNumber: '$essApplicationNumber',
              loanNumber: '$essLoanNumberAlias',
              checkNumber: '$essCheckNumber',
              amount: '$loanAmount',
              status: '$status',
              createdAt: '$createdAt',
              updatedAt: '$updatedAt',
              mifosClientId: '$mifosClientId',
              mifosLoanId: '$mifosLoanId',
              rejectedBy: '$rejectedBy',
              cancelledBy: '$cancelledBy'
            }
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Format for Grafana table panels
    const formattedStats = statusStats.map(stat => ({
      status: stat._id,
      count: stat.count,
      loans: stat.loans.slice(0, 100) // Limit to 100 loans per status for performance
    }));

    // Also get rejection/cancellation reasons
    const rejectionStats = await LoanMapping.aggregate([
      { $match: { status: 'REJECTED', rejectedBy: { $exists: true } } },
      {
        $group: {
          _id: '$rejectedBy',
          count: { $sum: 1 },
          reasons: { $push: '$rejectionReason' }
        }
      }
    ]);

    const cancellationStats = await LoanMapping.aggregate([
      { $match: { status: 'CANCELLED', cancelledBy: { $exists: true } } },
      {
        $group: {
          _id: '$cancelledBy',
          count: { $sum: 1 },
          reasons: { $push: '$cancellationReason' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        statusBreakdown: formattedStats,
        rejections: rejectionStats,
        cancellations: cancellationStats,
        totalLoans: formattedStats.reduce((sum, stat) => sum + stat.count, 0),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching loan status statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loan status statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/frontend/loan/records
 * Get individual loan records in tabular format for export
 * Query params:
 *   - status: Filter by loan status (optional)
 *   - limit: Max records to return (default: 1000, max: 5000)
 *   - offset: Pagination offset (default: 0)
 *   - format: 'json' or 'csv' (default: 'json')
 */
router.get('/loan/records', async (req, res) => {
  try {
    const LoanMapping = require('../models/LoanMapping');
    
    const { status, limit = 1000, offset = 0, format = 'json' } = req.query;
    
    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    
    // Validate and cap limit
    const limitNum = Math.min(parseInt(limit) || 1000, 5000);
    const offsetNum = parseInt(offset) || 0;
    
    // Fetch loans with all details
    const loans = await LoanMapping.find(query)
      .select({
        essApplicationNumber: 1,
        essLoanNumberAlias: 1,
        essCheckNumber: 1,
        status: 1,
        productCode: 1,
        requestedAmount: 1,
        tenure: 1,
        mifosClientId: 1,
        mifosLoanId: 1,
        rejectedBy: 1,
        rejectionReason: 1,
        cancelledBy: 1,
        cancellationReason: 1,
        failureReason: 1,
        createdAt: 1,
        updatedAt: 1,
        disbursementDate: 1,
        initialOfferSentAt: 1,
        finalApprovalReceivedAt: 1
      })
      .sort({ createdAt: -1 })
      .skip(offsetNum)
      .limit(limitNum)
      .lean();
    
    // Get total count for pagination
    const totalCount = await LoanMapping.countDocuments(query);
    
    console.log('[DEBUG] Query:', query);
    console.log('[DEBUG] Total count:', totalCount);
    console.log('[DEBUG] Loans found:', loans.length);
    console.log('[DEBUG] First loan:', loans[0]);
    
    // Format data for table display
    const records = loans.map(loan => ({
      applicationNumber: loan.essApplicationNumber || '',
      loanNumber: loan.essLoanNumberAlias || '',
      checkNumber: loan.essCheckNumber || '',
      status: loan.status || '',
      productCode: loan.productCode || '',
      amount: loan.requestedAmount || 0,
      tenure: loan.tenure || 0,
      mifosClientId: loan.mifosClientId || '',
      mifosLoanId: loan.mifosLoanId || '',
      rejectedBy: loan.rejectedBy || '',
      rejectionReason: loan.rejectionReason || '',
      cancelledBy: loan.cancelledBy || '',
      cancellationReason: loan.cancellationReason || '',
      failureReason: loan.failureReason || '',
      createdAt: loan.createdAt ? new Date(loan.createdAt).toISOString() : '',
      updatedAt: loan.updatedAt ? new Date(loan.updatedAt).toISOString() : '',
      disbursementDate: loan.disbursementDate ? new Date(loan.disbursementDate).toISOString() : '',
      initialOfferSentAt: loan.initialOfferSentAt ? new Date(loan.initialOfferSentAt).toISOString() : '',
      finalApprovalReceivedAt: loan.finalApprovalReceivedAt ? new Date(loan.finalApprovalReceivedAt).toISOString() : ''
    }));
    
    // Return CSV format if requested
    if (format === 'csv') {
      const fields = [
        'applicationNumber', 'loanNumber', 'checkNumber', 'status', 'productCode', 'amount', 'tenure',
        'mifosClientId', 'mifosLoanId', 'rejectedBy', 'rejectionReason',
        'cancelledBy', 'cancellationReason', 'failureReason',
        'createdAt', 'updatedAt', 'disbursementDate', 'initialOfferSentAt', 'finalApprovalReceivedAt'
      ];
      
      const csv = [
        fields.join(','),
        ...records.map(record => 
          fields.map(field => {
            const value = record[field] || '';
            // Escape commas and quotes in CSV
            return typeof value === 'string' && (value.includes(',') || value.includes('"'))
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          }).join(',')
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="loan-records-${new Date().toISOString()}.csv"`);
      return res.send(csv);
    }
    
    // Return JSON format (default)
    res.json({
      success: true,
      data: records,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: (offsetNum + limitNum) < totalCount
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching loan records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loan records',
      error: error.message
    });
  }
});

/**
 * GET /api/frontend/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Frontend API',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
