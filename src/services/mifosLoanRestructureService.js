const logger = require('../utils/logger');
const { maker: cbsApi, authManager, healthMonitor, errorHandler, requestManager } = require('./cbs.api');
const { API_ENDPOINTS } = require('./cbs.endpoints');

/**
 * MIFOS Loan Restructuring Service
 * Handles various types of loan restructuring operations
 */
class MifosLoanRestructureService {

  /**
   * Get available reschedule reasons
   */
  static async getRescheduleReasons() {
    try {
      const response = await cbsApi.get('/v1/rescheduleloans/template');
      if (response.status) {
        return response.response.rescheduleReasons || [];
      }
      throw new Error('Failed to fetch reschedule reasons');
    } catch (error) {
      logger.error('❌ Error fetching reschedule reasons:', error);
      throw error;
    }
  }

  /**
   * Create a loan reschedule request
   * @param {Object} rescheduleData - Reschedule request data
   * @param {number} rescheduleData.loanId - ID of the loan to reschedule
   * @param {string} rescheduleData.rescheduleFromDate - Date from which to reschedule (dd MMMM yyyy)
   * @param {number} rescheduleData.rescheduleReasonId - Reason ID for rescheduling
   * @param {string} rescheduleData.rescheduleReasonComment - Comment explaining the reschedule
   * @param {string} rescheduleData.submittedOnDate - Submission date (dd MMMM yyyy)
   * @param {Object} rescheduleData.graceOnPrincipal - Grace period on principal (optional)
   * @param {Object} rescheduleData.graceOnInterest - Grace period on interest (optional)
   * @param {number} rescheduleData.extraTerms - Additional terms to add (optional)
   * @param {number} rescheduleData.newInterestRate - New interest rate (optional)
   */
  static async createRescheduleRequest(rescheduleData) {
    try {
      logger.info('🔄 Creating loan reschedule request:', {
        loanId: rescheduleData.loanId,
        rescheduleFromDate: rescheduleData.rescheduleFromDate
      });

      const rescheduleRequest = {
        loanId: rescheduleData.loanId,
        rescheduleFromDate: rescheduleData.rescheduleFromDate,
        rescheduleReasonId: rescheduleData.rescheduleReasonId,
        rescheduleReasonComment: rescheduleData.rescheduleReasonComment || 'Loan restructuring request',
        submittedOnDate: rescheduleData.submittedOnDate,
        dateFormat: "dd MMMM yyyy",
        locale: "en"
      };

      // Add optional parameters if provided
      if (rescheduleData.graceOnPrincipal) {
        rescheduleRequest.graceOnPrincipal = rescheduleData.graceOnPrincipal;
      }

      if (rescheduleData.graceOnInterest) {
        rescheduleRequest.graceOnInterest = rescheduleData.graceOnInterest;
      }

      if (rescheduleData.extraTerms) {
        rescheduleRequest.extraTerms = rescheduleData.extraTerms;
      }

      if (rescheduleData.newInterestRate) {
        rescheduleRequest.newInterestRate = rescheduleData.newInterestRate;
      }

      const response = await cbsApi.post(API_ENDPOINTS.LOAN_RESHEDULE, rescheduleRequest);

      if (response.status) {
        logger.info('✅ Reschedule request created successfully:', {
          rescheduleId: response.response.resourceId,
          loanId: rescheduleData.loanId
        });
        return response.response;
      }

      throw new Error(`Reschedule request failed: ${response.message}`);

    } catch (error) {
      logger.error('❌ Error creating reschedule request:', error);
      throw error;
    }
  }

  /**
   * Approve a reschedule request
   * @param {number} rescheduleId - ID of the reschedule request
   * @param {string} approvedOnDate - Approval date (dd MMMM yyyy)
   * @param {string} note - Approval note (optional)
   */
  static async approveReschedule(rescheduleId, approvedOnDate, note = '') {
    try {
      logger.info('✅ Approving reschedule request:', { rescheduleId });

      const approvalData = {
        approvedOnDate: approvedOnDate,
        note: note,
        dateFormat: "dd MMMM yyyy",
        locale: "en"
      };

      const response = await cbsApi.post(
        `/v1/rescheduleloans/${rescheduleId}?command=approve`,
        approvalData
      );

      if (response.status) {
        logger.info('✅ Reschedule approved successfully:', {
          rescheduleId,
          changes: response.response.changes
        });
        return response.response;
      }

      throw new Error(`Reschedule approval failed: ${response.message}`);

    } catch (error) {
      logger.error('❌ Error approving reschedule:', error);
      throw error;
    }
  }

  /**
   * Reject a reschedule request
   * @param {number} rescheduleId - ID of the reschedule request
   * @param {string} rejectedOnDate - Rejection date (dd MMMM yyyy)
   * @param {string} note - Rejection reason
   */
  static async rejectReschedule(rescheduleId, rejectedOnDate, note) {
    try {
      logger.info('❌ Rejecting reschedule request:', { rescheduleId });

      const rejectionData = {
        rejectedOnDate: rejectedOnDate,
        note: note,
        dateFormat: "dd MMMM yyyy",
        locale: "en"
      };

      const response = await cbsApi.post(
        `/v1/rescheduleloans/${rescheduleId}?command=reject`,
        rejectionData
      );

      if (response.status) {
        logger.info('✅ Reschedule rejected successfully:', { rescheduleId });
        return response.response;
      }

      throw new Error(`Reschedule rejection failed: ${response.message}`);

    } catch (error) {
      logger.error('❌ Error rejecting reschedule:', error);
      throw error;
    }
  }

  /**
   * Get reschedule request details
   * @param {number} rescheduleId - ID of the reschedule request
   */
  static async getRescheduleDetails(rescheduleId) {
    try {
      const response = await cbsApi.get(`/v1/rescheduleloans/${rescheduleId}`);

      if (response.status) {
        return response.response;
      }

      throw new Error(`Failed to fetch reschedule details: ${response.message}`);

    } catch (error) {
      logger.error('❌ Error fetching reschedule details:', error);
      throw error;
    }
  }

  /**
   * Get all reschedule requests for a loan
   * @param {number} loanId - ID of the loan
   */
  static async getLoanReschedules(loanId) {
    try {
      const response = await cbsApi.get(`/v1/rescheduleloans?loanId=${loanId}`);

      if (response.status) {
        return response.response;
      }

      throw new Error(`Failed to fetch loan reschedules: ${response.message}`);

    } catch (error) {
      logger.error('❌ Error fetching loan reschedules:', error);
      throw error;
    }
  }

  /**
   * Modify loan application (before disbursement)
   * @param {number} loanId - ID of the loan application
   * @param {Object} modifications - Loan modifications
   */
  static async modifyLoanApplication(loanId, modifications) {
    try {
      logger.info('🔧 Modifying loan application:', { loanId, modifications });

      const modificationData = {
        ...modifications,
        dateFormat: "dd MMMM yyyy",
        locale: "en"
      };

      const response = await cbsApi.put(`/v1/loans/${loanId}`, modificationData);

      if (response.status) {
        logger.info('✅ Loan application modified successfully:', { loanId });
        return response.response;
      }

      throw new Error(`Loan modification failed: ${response.message}`);

    } catch (error) {
      logger.error('❌ Error modifying loan application:', error);
      throw error;
    }
  }

  /**
   * Complete loan restructuring workflow
   * @param {number} loanId - ID of the loan to restructure
   * @param {Object} restructureParams - Restructuring parameters
   */
  static async restructureLoan(loanId, restructureParams) {
    try {
      logger.info('🔄 Starting complete loan restructuring:', { loanId });

      // Step 1: Get loan details
      const loanDetails = await cbsApi.get(`/v1/loans/${loanId}`);
      if (!loanDetails.status) {
        throw new Error('Failed to fetch loan details');
      }

      // Step 2: Create reschedule request
      const rescheduleRequest = await this.createRescheduleRequest({
        loanId: loanId,
        rescheduleFromDate: restructureParams.rescheduleFromDate,
        rescheduleReasonId: restructureParams.rescheduleReasonId || 1,
        rescheduleReasonComment: restructureParams.reason || 'Loan restructuring due to customer request',
        submittedOnDate: restructureParams.submittedOnDate,
        extraTerms: restructureParams.extraTerms,
        newInterestRate: restructureParams.newInterestRate,
        graceOnPrincipal: restructureParams.graceOnPrincipal,
        graceOnInterest: restructureParams.graceOnInterest
      });

      const rescheduleId = rescheduleRequest.resourceId;

      // Step 3: Auto-approve if specified (for maker-checker workflow)
      if (restructureParams.autoApprove) {
        await this.approveReschedule(
          rescheduleId, 
          restructureParams.approvalDate || restructureParams.submittedOnDate,
          'Auto-approved via system'
        );
      }

      logger.info('✅ Loan restructuring completed successfully:', {
        loanId,
        rescheduleId,
        autoApproved: !!restructureParams.autoApprove
      });

      return {
        success: true,
        originalLoanId: loanId,
        rescheduleId: rescheduleId,
        status: restructureParams.autoApprove ? 'approved' : 'pending_approval',
        message: 'Loan restructuring completed successfully'
      };

    } catch (error) {
      logger.error('❌ Loan restructuring failed:', error);
      throw error;
    }
  }
}

module.exports = MifosLoanRestructureService;