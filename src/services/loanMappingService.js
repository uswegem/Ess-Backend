const logger = require('../utils/logger');
const LoanMapping = require('../models/LoanMapping');
const ClientService = require('./clientService');
const DBTransaction = require('../utils/dbTransaction');
const healthMonitor = require('../utils/loanMappingHealthMonitor');

class LoanMappingService {
  /**
   * Generate loan number alias in format: YYYYMMDDHHMM + 3 unique numbers
   */
  static generateLoanNumberAlias() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // Generate 3 unique numbers (using milliseconds for uniqueness)
    const unique = String(now.getMilliseconds()).padStart(3, '0').slice(-3);

    return `${year}${month}${day}${hours}${minutes}${unique}`;
  }

  /**
   * Create or update loan mapping with client data from LOAN_OFFER_REQUEST
   */
  static async createOrUpdateWithClientData(applicationNumber, checkNumber, clientData, loanData, employmentData, originalMessageType = null) {
    try {
      // Only update active mappings, not CANCELLED or REJECTED ones
      const filter = {
        essApplicationNumber: applicationNumber,
        status: { $nin: ['CANCELLED', 'REJECTED'] } // Exclude inactive statuses
      };

      const update = {
        essApplicationNumber: applicationNumber,
        essCheckNumber: checkNumber,
        productCode: loanData.productCode || "17",
        requestedAmount: loanData.requestedAmount,
        tenure: loanData.tenure || 24,
        status: 'OFFER_SUBMITTED',
        originalMessageType: originalMessageType, // Store original message type
        metadata: {
          clientData: clientData,
          loanData: loanData,
          employmentData: employmentData,
          offerReceivedAt: new Date().toISOString(),
          updatedVia: 'createOrUpdateWithClientData'
        },
        updatedAt: new Date()
      };

      const options = {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      };

      const mapping = await LoanMapping.findOneAndUpdate(filter, update, options);
      logger.info(`✅ Stored client data for application: ${applicationNumber}`, {
        mappingId: mapping._id,
        isNew: !mapping.createdAt || mapping.createdAt === mapping.updatedAt
      });
      return mapping;
    } catch (error) {
      logger.error('❌ Error storing client data:', {
        applicationNumber,
        checkNumber,
        error: error.message,
        stack: error.stack,
        errorType: error.name
      });
      throw error;
    }
  }

  /**
   * Create initial loan mapping when LOAN_INITIAL_APPROVAL_NOTIFICATION is sent
   */
  static async createInitialMapping(essApplicationNumber, essCheckNumber, fspReferenceNumber, loanDetails) {
    const startTime = Date.now();
    
    try {
      // Validate required parameters
      if (!essApplicationNumber) {
        throw new Error('ESS Application Number is required');
      }
      if (!fspReferenceNumber) {
        throw new Error('FSP Reference Number is required');
      }
      if (!loanDetails || typeof loanDetails.requestedAmount !== 'number' || loanDetails.requestedAmount <= 0) {
        throw new Error('Loan details with valid requested amount (greater than 0) are required');
      }

      // Check if mapping already exists to prevent duplicates
      // IMPORTANT: Exclude CANCELLED loans - they should not block new applications
      const existingMapping = await LoanMapping.findOne({
        essApplicationNumber,
        status: { $nin: ['CANCELLED', 'REJECTED'] } // Exclude inactive statuses
      });

      if (existingMapping) {
        logger.warn(`⚠️ Active loan mapping already exists for application: ${essApplicationNumber}`, {
          existingId: existingMapping._id,
          existingStatus: existingMapping.status,
          note: 'CANCELLED and REJECTED loans are not considered active'
        });
        return existingMapping;
      }

      // Check if a CANCELLED or REJECTED mapping exists (for logging)
      const cancelledMapping = await LoanMapping.findOne({
        essApplicationNumber,
        status: { $in: ['CANCELLED', 'REJECTED'] }
      });

      if (cancelledMapping) {
        logger.info(`ℹ️ Found ${cancelledMapping.status} loan mapping for application: ${essApplicationNumber}. Creating new mapping as this is treated as inactive.`, {
          previousId: cancelledMapping._id,
          previousStatus: cancelledMapping.status
        });
      }

      const mapping = new LoanMapping({
        essApplicationNumber,
        essCheckNumber,
        fspReferenceNumber,
        essLoanNumberAlias: loanDetails.essLoanNumberAlias, // Properly set from loanDetails
        productCode: loanDetails.productCode || "17", // Default product code if not provided
        requestedAmount: loanDetails.requestedAmount,
        tenure: loanDetails.tenure || 24, // Default tenure if not provided
        mifosClientId: loanDetails.clientId,
        mifosLoanId: loanDetails.loanId,
        status: loanDetails.status || 'INITIAL_OFFER', // Use provided status or default
        metadata: {
          initialOfferDetails: loanDetails,
          createdVia: 'createInitialMapping',
          createdAt: new Date().toISOString()
        }
      });

      await mapping.save();
      const duration = Date.now() - startTime;
      healthMonitor.recordOperation(true, duration);
      
      logger.info(`✅ Created initial loan mapping for application: ${essApplicationNumber}, check: ${essCheckNumber}, status: ${mapping.status}`, {
        mappingId: mapping._id,
        duration: `${duration}ms`
      });
      return mapping;
    } catch (error) {
      const duration = Date.now() - startTime;
      healthMonitor.recordOperation(false, duration, error);
      
      logger.error('❌ Error creating initial loan mapping:', {
        essApplicationNumber,
        essCheckNumber,
        fspReferenceNumber,
        error: error.message,
        stack: error.stack,
        errorType: error.name,
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  /**
   * Update mapping when LOAN_FINAL_APPROVAL_NOTIFICATION is received
   * Note: The loan number from ESS will be the same as our generated alias
   */
  static async updateWithFinalApproval(essLoanNumberAlias, finalApprovalData) {
    try {
      // Find mapping by ESS application number
      const mapping = await LoanMapping.findOne({
        essApplicationNumber: finalApprovalData.applicationNumber
      });

      if (!mapping) {
        throw new Error(`No loan mapping found for application: ${finalApprovalData.applicationNumber}`);
      }

      // The loan number from ESS should match our generated alias
      if (mapping.essLoanNumberAlias && mapping.essLoanNumberAlias !== essLoanNumberAlias) {
        logger.warn(`⚠️ ESS loan number alias mismatch. Expected: ${mapping.essLoanNumberAlias}, Received: ${essLoanNumberAlias}`);
      }

      // Update with final approval data (loan number alias should already be set)
      mapping.essLoanNumberAlias = essLoanNumberAlias; // Ensure it's set
      mapping.status = 'FINAL_APPROVAL_RECEIVED';
      mapping.finalApprovalReceivedAt = new Date();
      mapping.metadata = {
        ...mapping.metadata,
        finalApprovalDetails: finalApprovalData
      };

      await mapping.save();
      logger.info(`✅ Updated loan mapping with final approval for loan alias: ${essLoanNumberAlias}`);
      return mapping;
    } catch (error) {
      logger.error('❌ Error updating loan mapping with final approval:', error);
      throw error;
    }
  }

  /**
   * Update mapping when MIFOS client is created
   */
  static async updateWithClientCreation(essLoanNumberAlias, mifosClientId) {
    try {
      const mapping = await LoanMapping.findOne({ essLoanNumberAlias });
      if (!mapping) {
        throw new Error(`No loan mapping found for ESS loan alias: ${essLoanNumberAlias}`);
      }

      mapping.mifosClientId = mifosClientId;
      mapping.status = 'CLIENT_CREATED';
      mapping.clientCreatedAt = new Date();

      await mapping.save();
      logger.info(`✅ Updated loan mapping with MIFOS client ID: ${mifosClientId}`);
      return mapping;
    } catch (error) {
      logger.error('❌ Error updating loan mapping with client creation:', error);
      throw error;
    }
  }

  /**
   * Update mapping when MIFOS loan is created
   */
  static async updateWithLoanCreation(essLoanNumberAlias, mifosLoanId, mifosLoanAccountNumber) {
    try {
      const mapping = await LoanMapping.findOne({ essLoanNumberAlias });
      if (!mapping) {
        throw new Error(`No loan mapping found for ESS loan alias: ${essLoanNumberAlias}`);
      }

      mapping.mifosLoanId = mifosLoanId;
      mapping.mifosLoanAccountNumber = mifosLoanAccountNumber;
      mapping.status = 'LOAN_CREATED';
      mapping.loanCreatedAt = new Date();

      await mapping.save();
      logger.info(`✅ Updated loan mapping with MIFOS loan ID: ${mifosLoanId}, Account: ${mifosLoanAccountNumber}`);
      return mapping;
    } catch (error) {
      logger.error('❌ Error updating loan mapping with loan creation:', error);
      throw error;
    }
  }

  /**
   * Update mapping when loan is disbursed
   */
  static async updateWithDisbursement(mifosLoanId) {
    try {
      const mapping = await LoanMapping.findByMifosLoanId(mifosLoanId);
      if (!mapping) {
        throw new Error(`No loan mapping found for MIFOS loan ID: ${mifosLoanId}`);
      }

      mapping.status = 'DISBURSED';
      mapping.disbursedAt = new Date();

      await mapping.save();
      logger.info(`✅ Updated loan mapping with disbursement for loan ID: ${mifosLoanId}`);
      return mapping;
    } catch (error) {
      logger.error('❌ Error updating loan mapping with disbursement:', error);
      throw error;
    }
  }

  /**
   * Update mapping with loan final approval details
   */
  static async updateLoanMapping(loanData) {
    try {
        // Find by application number first
        let mapping = await LoanMapping.findOne({ 
            essApplicationNumber: loanData.essApplicationNumber
        });

        if (!mapping) {
            // If no existing mapping found by application number, try loan number or FSP reference
            mapping = await LoanMapping.findOne({
                $or: [
                    { essLoanNumberAlias: loanData.essLoanNumberAlias },
                    { fspReferenceNumber: loanData.fspReferenceNumber }
                ]
            });
        }

        if (!mapping) {
            // If still no mapping found, create a new one
            mapping = new LoanMapping({
                essApplicationNumber: loanData.essApplicationNumber,
                essLoanNumberAlias: loanData.essLoanNumberAlias,
                fspReferenceNumber: loanData.fspReferenceNumber,
                productCode: loanData.productCode || "17", // Default product code
                requestedAmount: loanData.requestedAmount || 5000000, // Default amount
                tenure: loanData.tenure || 24, // Default tenure
                status: loanData.status,
                mifosClientId: loanData.mifosClientId,
                metadata: loanData.metadata || {}
            });

            if (loanData.status === 'FINAL_APPROVAL_RECEIVED') {
                mapping.finalApprovalReceivedAt = new Date();
            } else if (loanData.status === 'DISBURSED') {
                mapping.disbursedAt = new Date();
            }
        } else {
            // Check if fspReferenceNumber would cause duplicate
            if (loanData.fspReferenceNumber && loanData.fspReferenceNumber !== mapping.fspReferenceNumber) {
                const existingWithFsp = await LoanMapping.findOne({ 
                    fspReferenceNumber: loanData.fspReferenceNumber,
                    essApplicationNumber: { $ne: loanData.essApplicationNumber }
                });
                
                if (existingWithFsp) {
                    logger.warn(`⚠️ FSP Reference ${loanData.fspReferenceNumber} already used by ${existingWithFsp.essApplicationNumber}, skipping fspReferenceNumber update`);
                    // Remove fspReferenceNumber from update to avoid duplicate key error
                    delete loanData.fspReferenceNumber;
                }
            }
            
            // Update fields that are provided in loanData
            Object.keys(loanData).forEach(key => {
                if (loanData[key] !== undefined && key !== '_id') {
                    mapping[key] = loanData[key];
                }
            });

            // Special handling for status transitions
            if (loanData.status === 'FINAL_APPROVAL_RECEIVED' && !mapping.finalApprovalReceivedAt) {
                mapping.finalApprovalReceivedAt = new Date();
            } else if (loanData.status === 'DISBURSED' && !mapping.disbursedAt) {
                mapping.disbursedAt = new Date();
            }

            // Special handling for metadata to prevent overwriting
            if (loanData.metadata) {
                mapping.metadata = {
                    ...mapping.metadata,
                    ...loanData.metadata
                };
            }
        }

        const savedMapping = await mapping.save();
        logger.info('✅ Updated loan mapping:', {
            applicationNumber: savedMapping.essApplicationNumber,
            loanNumber: savedMapping.essLoanNumberAlias,
            status: savedMapping.status,
            requestedAmount: savedMapping.requestedAmount,
            clientId: savedMapping.mifosClientId
        });
        return savedMapping;
    } catch (error) {
        logger.error('❌ Error updating loan mapping:', error);
        throw error;
    }
  }

  /**
   * Get loan mapping by ESS loan number alias
   */
  static async getByEssLoanNumberAlias(essLoanNumberAlias) {
    try {
      const mapping = await LoanMapping.findOne({ essLoanNumberAlias }).lean();
      if (!mapping) {
        throw new Error(`No loan mapping found for ESS loan alias: ${essLoanNumberAlias}`);
      }
      return mapping;
    } catch (error) {
      logger.error('❌ Error retrieving loan mapping:', error);
      throw error;
    }
  }

  /**
   * Get loan mapping by ESS application number
   * @param {string} essApplicationNumber - The ESS application number
   * @param {boolean} includeInactive - Whether to include CANCELLED/REJECTED loans (default: true)
   */
  static async getByEssApplicationNumber(essApplicationNumber, includeInactive = true) {
    try {
      const query = {
        $or: [
          { essApplicationNumber },
          { restructureApplicationNumber: essApplicationNumber } // Also search by restructure application number
        ]
      };
      
      // Optionally exclude inactive statuses
      if (!includeInactive) {
        query.status = { $nin: ['CANCELLED', 'REJECTED'] };
      }
      
      const mapping = await LoanMapping.findOne(query).lean();
      if (!mapping) {
        throw new Error(`No loan mapping found for ESS application: ${essApplicationNumber}`);
      }
      return mapping;
    } catch (error) {
      logger.error('❌ Error retrieving loan mapping:', error);
      throw error;
    }
  }

  /**
   * Get loan mapping by FSP reference number
   */
  static async getByFspReference(fspReferenceNumber) {
    try {
      const mapping = await LoanMapping.findByFspReference(fspReferenceNumber).lean();
      if (!mapping) {
        throw new Error(`No loan mapping found for FSP reference: ${fspReferenceNumber}`);
      }
      return mapping;
    } catch (error) {
      logger.error('❌ Error retrieving loan mapping:', error);
      throw error;
    }
  }

  /**
   * Get loan mapping by MIFOS loan ID
   */
  static async getByMifosLoanId(mifosLoanId) {
    try {
      const mapping = await LoanMapping.findByMifosLoanId(mifosLoanId).lean();
      if (!mapping) {
        throw new Error(`No loan mapping found for MIFOS loan ID: ${mifosLoanId}`);
      }
      return mapping;
    } catch (error) {
      logger.error('❌ Error retrieving loan mapping:', error);
      throw error;
    }
  }

  /**
   * Add error to mapping
   */
  static async addError(essLoanNumber, stage, error) {
    try {
      const mapping = await LoanMapping.findByEssLoanNumber(essLoanNumber);
      if (mapping) {
        await mapping.addError(stage, error);
      }
    } catch (error) {
      logger.error('❌ Error adding error to loan mapping:', error);
    }
  }

  /**
   * Get all mappings by status
   */
  static async getByStatus(status) {
    try {
      return await LoanMapping.find({ status }).sort({ createdAt: -1 }).lean();
    } catch (error) {
      logger.error('❌ Error retrieving loan mappings by status:', error);
      throw error;
    }
  }

  /**
   * Get mapping statistics
   */
  static async getStats() {
    try {
      const stats = await LoanMapping.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {};
      stats.forEach(stat => {
        result[stat._id] = stat.count;
      });

      return result;
    } catch (error) {
      logger.error('❌ Error getting loan mapping stats:', error);
      throw error;
    }
  }

  /**
   * Update loan mapping status with additional metadata
   */
  static async updateStatus(essApplicationNumber, newStatus, additionalData = {}) {
    try {
      const update = {
        status: newStatus,
        updatedAt: new Date(),
        ...additionalData
      };

      // If metadata is provided, merge it with existing metadata
      if (additionalData.metadata) {
        const existing = await LoanMapping.findOne({ essApplicationNumber });
        if (existing && existing.metadata) {
          update.metadata = {
            ...existing.metadata,
            ...additionalData.metadata
          };
        }
      }

      const mapping = await LoanMapping.findOneAndUpdate(
        { essApplicationNumber },
        update,
        { new: true }
      );

      if (!mapping) {
        throw new Error(`Loan mapping not found for application: ${essApplicationNumber}`);
      }

      logger.info(`✅ Updated loan mapping status to ${newStatus} for application: ${essApplicationNumber}`);
      return mapping;
    } catch (error) {
      logger.error('❌ Error updating loan mapping status:', error);
      throw error;
    }
  }

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
}

module.exports = LoanMappingService;