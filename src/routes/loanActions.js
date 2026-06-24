// Loan action routes for manually triggering notifications
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');
const LoanMappingService = require('../services/loanMappingService');
const disbursementUtils = require('../utils/disbursementUtils');
const digitalSignature = require('../utils/signatureUtils');
const { formatDateForUTUMISHI } = require('../utils/dateUtils');
const logger = require('../utils/logger');

const loanActionGuards = [
  authMiddleware,
  roleMiddleware(['super_admin', 'admin', 'tenant_admin', 'operations_manager']),
  permissionMiddleware('loans:operate')
];

/**
 * @swagger
 * /api/v1/loan-actions/send-disbursement-notification:
 *   post:
 *     summary: Send disbursement notification
 *     description: Manually trigger LOAN_DISBURSEMENT_NOTIFICATION. Requires loans:operate; loan lookups scoped by tenant (M3).
 *     tags: [Loan Actions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               loanId: { type: string, description: MIFOS loan ID }
 *               applicationNumber: { type: string, description: ESS application number }
 *             description: Provide loanId or applicationNumber
 *     responses:
 *       200:
 *         description: Notification sent; loan status updated to DISBURSED
 *       400:
 *         description: Invalid status or missing identifiers
 *       404:
 *         description: Loan mapping not found
 */
router.post('/send-disbursement-notification', ...loanActionGuards, async (req, res) => {
    try {
        const { loanId, applicationNumber } = req.body;
        const tenantId = req.tenant?.tenantId || null;

        if (!loanId && !applicationNumber) {
            return res.status(400).json({ success: false, message: 'Either loanId or applicationNumber is required' });
        }

        // Get loan mapping
        let loanMapping;
        if (loanId) {
            loanMapping = await LoanMappingService.getByMifosLoanId(loanId, tenantId);
        } else {
            loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber, true, tenantId);
        }

        if (!loanMapping) {
            return res.status(404).json({ success: false, message: 'Loan mapping not found' });
        }

        if (loanMapping.status !== 'LOAN_CREATED') {
            return res.status(400).json({ success: false, message: `Loan must be in LOAN_CREATED status. Current status: ${loanMapping.status}` });
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

        // Update loan status
        const existingMetadata = loanMapping.metadata || {};
        const manualDisbursementInfo = {
            triggeredBy: req.user.username,
            triggeredAt: new Date().toISOString(),
            result: result
        };
        const updatedMetadata = Object.assign({}, existingMetadata, { manualDisbursement: manualDisbursementInfo });

        await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, 'DISBURSED', {
            disbursedAt: new Date(),
            metadata: updatedMetadata
        }, tenantId);

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
        res.status(500).json({ success: false, message: error.message || 'Failed to send disbursement notification' });
    }
});

/**
 * @swagger
 * /api/v1/loan-actions/send-disbursement-failure:
 *   post:
 *     summary: Send disbursement failure notification
 *     description: Manually trigger LOAN_DISBURSEMENT_FAILURE_NOTIFICATION. Requires loans:operate (M3).
 *     tags: [Loan Actions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               loanId: { type: string }
 *               applicationNumber: { type: string }
 *               reason: { type: string }
 *               errorDetails: { type: string }
 *     responses:
 *       200:
 *         description: Failure notification sent; loan status updated to FAILED
 *       400:
 *         description: Missing reason or invalid status
 *       404:
 *         description: Loan mapping not found
 */
router.post('/send-disbursement-failure', ...loanActionGuards, async (req, res) => {
    try {
        const { loanId, applicationNumber, reason, errorDetails } = req.body;
        const tenantId = req.tenant?.tenantId || null;

        if (!loanId && !applicationNumber) {
            return res.status(400).json({ success: false, message: 'Either loanId or applicationNumber is required' });
        }

        if (!reason) {
            return res.status(400).json({ success: false, message: 'Failure reason is required' });
        }

        // Get loan mapping
        let loanMapping;
        if (loanId) {
            loanMapping = await LoanMappingService.getByMifosLoanId(loanId, tenantId);
        } else {
            loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber, true, tenantId);
        }

        if (!loanMapping) {
            return res.status(404).json({ success: false, message: 'Loan mapping not found' });
        }

        if (loanMapping.status !== 'LOAN_CREATED') {
            return res.status(400).json({ success: false, message: `Loan must be in LOAN_CREATED status. Current status: ${loanMapping.status}` });
        }

        // Create failure notification - only include fields expected by Utumishi schema
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
                Reason: reason  // Only ApplicationNumber and Reason per Utumishi schema
            }
        };

        const signedNotification = digitalSignature.createSignedXML(failureNotificationData);
        
        logger.info(`Sending LOAN_DISBURSEMENT_FAILURE_NOTIFICATION for loan: ${loanMapping.essApplicationNumber}`);
        logger.info(`Notification: ${signedNotification.substring(0, 500)}...`);

        // Update loan status - using explicit object construction to avoid spread operator issues
        const existingMetadata = loanMapping.metadata || {};
        const disbursementFailureInfo = {
            reason: reason,
            errorDetails: errorDetails,
            triggeredBy: req.user.username,
            triggeredAt: new Date().toISOString()
        };
        const updatedMetadata = Object.assign({}, existingMetadata, { disbursementFailure: disbursementFailureInfo });

        await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, 'FAILED', {
            failedAt: new Date(),
            metadata: updatedMetadata
        }, tenantId);

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
        res.status(500).json({ success: false, message: error.message || 'Failed to send disbursement failure notification' });
    }
});

module.exports = router;
