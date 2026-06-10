const logger = require('../utils/logger');
const MessageLog = require('../models/MessageLog');
const { forwardToThirdParty } = require('../services/thirdPartyService');
const digitalSignature = require('../utils/signatureUtils');

class MessageController {
  static async getMessageLogs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const {
        messageType,
        status,
        applicationNumber,
        loanNumber,
        startDate,
        endDate,
        direction = 'outgoing'
      } = req.query;

      let filter = { direction };

      if (messageType) filter.messageType = messageType;
      if (status) filter.status = status;
      if (applicationNumber) filter.applicationNumber = applicationNumber;
      if (loanNumber) filter.loanNumber = loanNumber;

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const messages = await MessageLog.find(filter)
        .populate('sentBy', 'username fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await MessageLog.countDocuments(filter);

      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get message logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching message logs.'
      });
    }
  }

  static async getMessageStats(req, res) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stats = await MessageLog.aggregate([
        {
          $match: {
            direction: 'outgoing',
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: '$messageType',
            count: { $sum: 1 },
            sent: {
              $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            resent: {
              $sum: { $cond: [{ $eq: ['$status', 'resent'] }, 1, 0] }
            }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const totalMessages = await MessageLog.countDocuments({
        direction: 'outgoing',
        createdAt: { $gte: thirtyDaysAgo }
      });

      res.json({
        success: true,
        data: {
          stats,
          totalMessages,
          period: '30 days'
        }
      });

    } catch (error) {
      logger.error('Get message stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching message statistics.'
      });
    }
  }

  static async resendMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;

      // Find the original message
      const originalMessage = await MessageLog.findOne({ messageId });

      if (!originalMessage) {
        return res.status(404).json({
          success: false,
          message: 'Message not found.'
        });
      }

      if (originalMessage.direction !== 'outgoing') {
        return res.status(400).json({
          success: false,
          message: 'Only outgoing messages can be resent.'
        });
      }

      logger.info(`Resending message ${messageId} of type ${originalMessage.messageType}`);

      try {
        // Sign the XML payload again (in case keys have changed)
        const signedXml = await digitalSignature.signXML(originalMessage.xmlPayload);

        // Send to third party
        const response = await forwardToThirdParty(signedXml, originalMessage.messageType, {
          applicationNumber: originalMessage.applicationNumber,
          loanNumber: originalMessage.loanNumber,
          fspReferenceNumber: originalMessage.fspReferenceNumber,
          resentFrom: originalMessage.messageId
        }, userId);

        // Update the original message record
        await MessageLog.findByIdAndUpdate(originalMessage._id, {
          status: 'resent',
          response: typeof response === 'string' ? response : JSON.stringify(response),
          resentAt: new Date(),
          retryCount: originalMessage.retryCount + 1,
          errorMessage: null
        });

        // Create a new message log entry for the resend
        const resentMessage = new MessageLog({
          messageId: `${originalMessage.messageId}_resent_${Date.now()}`,
          messageType: originalMessage.messageType,
          direction: 'outgoing',
          status: 'sent',
          xmlPayload: signedXml,
          response: typeof response === 'string' ? response : JSON.stringify(response),
          applicationNumber: originalMessage.applicationNumber,
          loanNumber: originalMessage.loanNumber,
          fspReferenceNumber: originalMessage.fspReferenceNumber,
          sentBy: userId,
          sentAt: new Date(),
          retryCount: 0,
          metadata: {
            originalMessageId: originalMessage.messageId,
            resentFrom: originalMessage._id
          }
        });

        await resentMessage.save();

        res.json({
          success: true,
          message: 'Message resent successfully.',
          data: {
            originalMessageId: messageId,
            newMessageId: resentMessage.messageId,
            response: response
          }
        });

      } catch (sendError) {
        // Update the message with failure status
        await MessageLog.findByIdAndUpdate(originalMessage._id, {
          status: 'failed',
          errorMessage: sendError.message,
          retryCount: originalMessage.retryCount + 1
        });

        throw sendError;
      }

    } catch (error) {
      logger.error('Resend message error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while resending message.',
        error: error.message
      });
    }
  }

  static async getMessageById(req, res) {
    try {
      const { messageId } = req.params;

      const message = await MessageLog.findOne({ messageId })
        .populate('sentBy', 'username fullName');

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found.'
        });
      }

      res.json({
        success: true,
        data: message
      });

    } catch (error) {
      logger.error('Get message by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching message.'
      });
    }
  }

  static async getMessageTypes(req, res) {
    try {
      const messageTypes = [
        'RESPONSE',
        'ACCOUNT_VALIDATION_RESPONSE',
        'DEFAULTER_DETAILS_TO_EMPLOYER',
        'FSP_BRANCHES',
        'FULL_LOAN_REPAYMENT_NOTIFICATION',
        'FULL_LOAN_REPAYMENT_REQUEST',
        'LOAN_CHARGES_RESPONSE',
        'LOAN_DISBURSEMENT_FAILURE_NOTIFICATION',
        'LOAN_DISBURSEMENT_NOTIFICATION',
        'LOAN_INITIAL_APPROVAL_NOTIFICATION',
        'LOAN_LIQUIDATION_NOTIFICATION',
        'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST',
        'LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE',
        'LOAN_RESTRUCTURE_BALANCE_REQUEST',
        'LOAN_RESTRUCTURE_BALANCE_RESPONSE',
        'LOAN_RESTRUCTURE_REQUEST_FSP',
        'LOAN_STATUS_REQUEST',
        'LOAN_TAKEOVER_BALANCE_RESPONSE',
        'LOAN_TOP_UP_BALANCE_RESPONSE',
        'PARTIAL_LOAN_REPAYMENT_NOTIFICATION',
        'PARTIAL_REPAYMENT_OFF_BALANCE_RESPONSE',
        'PAYMENT_ACKNOWLEDGMENT_NOTIFICATION',
        'PRODUCT_DECOMMISSION',
        'PRODUCT_DETAIL',
        'TAKEOVER_DISBURSEMENT_NOTIFICATION'
      ];

      res.json({
        success: true,
        data: messageTypes
      });

    } catch (error) {
      logger.error('Get message types error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching message types.'
      });
    }
  }
}

module.exports = MessageController;