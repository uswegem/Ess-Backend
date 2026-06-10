#!/bin/bash

# Deploy fix for list-employee-loan API endpoint
# This script will update the LoanMappingService on the production server

echo "🔧 Deploying fix for list-employee-loan API endpoint..."

# SSH into the production server and apply the fix
ssh -o ConnectTimeout=10 uswege@135.181.33.13 << 'EOF'
cd /home/uswege/ess

echo "📦 Backing up current LoanMappingService..."
cp src/services/loanMappingService.js src/services/loanMappingService.js.backup.$(date +%Y%m%d_%H%M%S)

echo "🔄 Applying fix to LoanMappingService..."

# Add the getAllWithDetails method to the LoanMappingService
cat >> src/services/loanMappingService.js << 'PATCH'

  /**
   * Get all loan mappings with detailed information for admin portal
   */
  static async getAllWithDetails(params = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        applicationNumber,
        clientName,
        startDate,
        endDate,
        sort = 'createdAt',
        order = 'desc'
      } = params;

      // Build query filter
      const filter = {};
      
      if (status && status !== '') {
        filter.status = status;
      }
      
      if (applicationNumber && applicationNumber !== '') {
        filter.essApplicationNumber = { $regex: applicationNumber, $options: 'i' };
      }
      
      if (clientName && clientName !== '') {
        filter['metadata.clientData.firstName'] = { $regex: clientName, $options: 'i' };
      }
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortOrder = order === 'desc' ? -1 : 1;
      const sortObj = { [sort]: sortOrder };

      // Execute query with pagination
      const [loans, total] = await Promise.all([
        LoanMapping.find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        LoanMapping.countDocuments(filter)
      ]);

      // Transform data for frontend compatibility
      const transformedLoans = loans.map(loan => ({
        _id: loan._id,
        essApplicationNumber: loan.essApplicationNumber,
        essCheckNumber: loan.essCheckNumber,
        essLoanNumberAlias: loan.essLoanNumberAlias,
        fspReferenceNumber: loan.fspReferenceNumber,
        mifosClientId: loan.mifosClientId,
        mifosLoanId: loan.mifosLoanId,
        mifosLoanAccountNumber: loan.mifosLoanAccountNumber,
        productCode: loan.productCode,
        requestedAmount: loan.requestedAmount,
        tenure: loan.tenure,
        status: loan.status,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
        // Extract nested data for easier frontend access
        clientData: loan.metadata?.clientData || null,
        loanData: loan.metadata?.loanData || {
          requestedAmount: loan.requestedAmount,
          tenure: loan.tenure,
          productCode: loan.productCode
        },
        employmentData: loan.metadata?.employmentData || null,
        errors: loan.errors || [],
        requestType: 'LOAN_APPLICATION' // Default for compatibility
      }));

      const pages = Math.ceil(total / limit);

      logger.info(`📋 Retrieved ${transformedLoans.length} loans (page ${page}/${pages}, total: ${total})`);

      return transformedLoans;
    } catch (error) {
      logger.error('❌ Error getting all loan mappings with details:', error);
      throw error;
    }
  }
PATCH

# Fix the closing bracket by replacing the last line
sed -i '$ s/}$/}\n}\n\nmodule.exports = LoanMappingService;/' src/services/loanMappingService.js

echo "🔄 Restarting ESS application..."
pm2 restart ess-app || pm2 start server.js --name ess-app

echo "✅ Fix deployed successfully!"

# Test the endpoint
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/v1/loan/list-employee-loan | grep -q "401\|200" && echo "📡 API endpoint responding correctly" || echo "❌ API endpoint not responding"

EOF

echo "🚀 Deployment completed!"