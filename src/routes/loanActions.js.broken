// Loan action routes for manually triggering notifications
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const LoanMappingService = require('../services/loanMappingService');
const disbursementUtils = require('../utils/disbursementUtils');
const digitalSignature = require('../utils/signatureUtils');
const logger = require('../utils/logger');

/**
 * Send LOAN_DISBURSEMENT_NOTIFICATION manually
 * POST /api/v1/loan-actions/send-disbursement-notification
 */
router.post('/send-disbursement-notification', authMiddleware, roleMiddleware(['super_admin', 'admin']), async (req, res) => {
    try {
        const { loanId, applicationNumber } = req.body;

        if (!loanId && !applicationNumber) {
            return res.status(400).json({
                success: false,
                message: 'Either loanId or applicationNumber is required'
            });
        }

        // Get loan mapping
        let loanMapping;
        if (loanId) {
            loanMapping = await LoanMappingService.getByMifosLoanId(loanId);
        } else {
            loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber);
        }

        if (!loanMapping) {
            return res.status(404).json({
                success: false,
                message: 'Loan mapping not found'
            });
        }

        // Check if loan is in LOAN_CREATED status
        if (loanMapping.status !== 'LOAN_CREATED') {
            return res.status(400).json({
                success: false,
                message: `Loan must be in LOAN_CREATED status. Current status: ${loanMapping.status}`
            });
        }

        // Send disbursement notification
        const notificationData = {
            essLoanNumberAlias: loanMapping.essLoanNumberAlias,
            essApplicationNumber: loanMapping.essApplicationNumber,
            mifosClientId: loanMapping.mifosClientId,
            mifosLoanId: loanMapping.mifosLoanId,
            mifosLoanAccountNumber: loanMapping.mifosLoanAccountNumber,
            requestedAmount: loanMapping.requestedAmount,
            clientData: loanMapping.metadata?.clientData || {},
            loanData: loanMapping.metadata?.loanData || {}
        };

        const result = await disbursementUtils.sendDisbursementNotification(notificationData);

        // Update loan status to DISBURSED
        await LoanMappingService.updateStatus(
            loanMapping.essApplicationNumber,
            'DISBURSED',
            {
                disbursedAt: new Date(),
                metadata: {
                    ...loanMapping.metadata,
                    manualDisbursement: {
                        triggeredBy: req.user.username,
                        triggeredAt: new Date().toISOString(),
                        result: result
                    }
                }
            }
        );

        logger.info(`Manual disbursement notification sent for loan: ${loanMapping.essApplicationNumber} by ${req.user.username}`);

        res.json({
            success: true,
            message: 'Disbursement notification sent successfully',
            data: {
                loanId: loanMapping.mifosLoanId,
                applicationNumber: loanMapping.essApplicationNumber,
                status: 'DISBURSED',
                result: result
            }
        });

    } catch (error) {
        logger.error('Error sending disbursement notification:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send disbursement notification'
        });
    }
});

/**
 * Send LOAN_DISBURSEMENT_FAILURE_NOTIFICATION manually
 * POST /api/v1/loan-actions/send-disbursement-failure
 */
router.post('/send-disbursement-failure', authMiddleware, roleMiddleware(['super_admin', 'admin']), async (req, res) => {
    try {
        const { loanId, applicationNumber, reason, errorDetails } = req.body;

        if (!loanId && !applicationNumber) {
            return res.status(400).json({
                success: false,
                message: 'Either loanId or applicationNumber is required'
            });
        }

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Failure reason is required'
            });
        }

        // Get loan mapping
        let loanMapping;
        if (loanId) {
            loanMapping = await LoanMappingService.getByMifosLoanId(loanId);
        } else {
            loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber);
        }

        if (!loanMapping) {
            return res.status(404).json({
                success: false,
                message: 'Loan mapping not found'
            });
        }

        // Check if loan is in LOAN_CREATED status
        if (loanMapping.status !== 'LOAN_CREATED') {
            return res.status(400).json({
                success: false,
                message: `Loan must be in LOAN_CREATED status. Current status: ${loanMapping.status}`
            });
        }

        // Create failure notification
        const failureNotificationData = {
            Header: {
                Sender: process.env.FSP_NAME || "ZE DONE",
                Receiver: "ESS_UTUMISHI",
                FSPCode: process.env.FSP_CODE || "FL8090",
                MsgId: `DISB_FAIL_${Date.now()}`,
                MessageType: "LOAN_DISBURSEMENT_FAILURE_NOTIFICATION"
            },
            MessageDetails: {
                ApplicationNumber: loanMapping.essApplicationNumber,
                LoanNumber: loanMapping.essLoanNumberAlias,
                FSPReferenceNumber: loanMapping.fspReferenceNumber,
                FailureReason: reason,
                ErrorDetails: errorDetails || "Manual disbursement failure notification",
                Status: "FAILED",
                Timestamp: new Date().toISOString()
            }
        };

        // Sign and send the notification
        const signedNotification = digitalSignature.createSignedXML(failureNotificationData);
        
        // Here you would send to ESS callback URL if configured
        // For now, we just log it
        logger.info(`Sending LOAN_DISBURSEMENT_FAILURE_NOTIFICATION for loan: ${loanMapping.essApplicationNumber}`);
        logger.info(`Notification: ${signedNotification.substring(0, 500)}...`);

        // Update loan status to FAILED
        await LoanMappingService.updateStatus(
            loanMapping.essApplicationNumber,
            'FAILED',
            {
                failedAt: new Date(),
                metadata: {
                    ...loanMapping.metadata,
                    disbursementFailure: {
                        reason: reason,
                        errorDetails: errorDetails,
                        triggeredBy: req.user.username,
                        triggeredAt: new Date().toISOString()
                    }
                }
            }
        });

        logger.info(`Manual disbursement failure notification sent for loan: ${loanMapping.essApplicationNumber} by ${req.user.username}`);

        res.json({
            success: true,
            message: 'Disbursement failure notification sent successfully',
            data: {
                loanId: loanMapping.mifosLoanId,
                applicationNumber: loanMapping.essApplicationNumber,
                status: 'FAILED',
                notification: signedNotification.substring(0, 500) + '...'
            }
        });

    } catch (error) {
        logger.error('Error sending disbursement failure notification:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send disbursement failure notification'
        });
    }
});

module.exports = router;
