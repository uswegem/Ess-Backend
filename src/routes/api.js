const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const api = require('../services/cbs.api');
const disbursementUtils = require('../utils/disbursementUtils');
const digitalSignature = require('../utils/signatureUtils');
const xml2js = require('xml2js');
const loanStatusController = require('../controllers/loanStatusController');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/loan:
 *   post:
 *     summary: Process loan request
 *     description: |
 *       Main endpoint for processing all types of loan requests from ESS UTUMISHI.
 *       Handles XML messages with digital signatures for various loan operations.
 *       
 *       **Supported Message Types:**
 *       - LOAN_OFFER_REQUEST - New loan application
 *       - TOP_UP_OFFER_REQUEST - Loan top-up request
 *       - LOAN_TAKEOVER_OFFER_REQUEST - Loan takeover from another FSP
 *       - LOAN_RESTRUCTURE_REQUEST - Loan restructuring
 *       - LOAN_FINAL_APPROVAL_NOTIFICATION - Employer final approval
 *       - LOAN_CANCELLATION_NOTIFICATION - Employee cancellation
 *       - LOAN_CHARGES_REQUEST - Loan charges inquiry
 *       - TOP_UP_PAY_0FF_BALANCE_REQUEST - Balance for top-up
 *       - TAKEOVER_PAY_OFF_BALANCE_REQUEST - Balance for takeover
 *       - TAKEOVER_PAYMENT_NOTIFICATION - Payment confirmation
 *       
 *     tags:
 *       - Loan Processing
 *     security:
 *       - digitalSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/xml:
 *           schema:
 *             type: string
 *             example: |
 *               <?xml version="1.0" encoding="UTF-8"?>
 *               <Document><Data><Header><Sender>ESS_UTUMISHI</Sender></Header></Data></Document>
 *     responses:
 *       200:
 *         description: Successful response with XML
 *         content:
 *           application/xml:
 *             schema:
 *               type: string
 */
// Main API endpoint for loan-related requests
router.post('/loan', apiController.processRequest);

/**
 * @swagger
 * /api/webhook/mifos:
 *   post:
 *     summary: MIFOS webhook handler
 *     description: Receives webhook notifications from MIFOS Core Banking System for loan events
 *     tags:
 *       - Loan Processing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entityName:
 *                 type: string
 *                 example: "LOAN"
 *               actionName:
 *                 type: string
 *                 example: "DISBURSE"
 *               entityId:
 *                 type: integer
 *                 example: 123
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
// Webhook endpoint for MIFOS notifications (bypass signature verification)
router.post('/webhook/mifos', apiController.handleMifosWebhook);

// Endpoint to manually trigger loan disbursement notification
router.post('/loan/disburse', async (req, res) => {
    try {
        const result = await disbursementUtils.sendDisbursementNotification(req.body);
        res.json({ success: true, message: 'Disbursement notification sent successfully', result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/sign:
 *   post:
 *     summary: Generate digital signature for XML
 *     description: Helper endpoint to generate digitally signed XML for testing purposes
 *     tags:
 *       - Admin
 *     requestBody:
 *       required: true
 *       content:
 *         application/xml:
 *           schema:
 *             type: string
 *             example: |
 *               <?xml version="1.0" encoding="UTF-8"?>
 *               <Document><Data><Header><Sender>TEST</Sender></Header></Data></Document>
 *     responses:
 *       200:
 *         description: Signed XML returned
 *         content:
 *           application/xml:
 *             schema:
 *               type: string
 *       500:
 *         description: Error generating signature
 */
// Endpoint for Postman collection to generate signatures
router.post('/sign', async (req, res) => {
    try {
        // Parse the incoming XML string into an object
        const parser = new xml2js.Parser({ explicitArray: false });
        const parsedXml = await parser.parseStringPromise(req.body);
        
        // Extract the Data part (createSignedXML expects just the Data object)
        const dataToSign = parsedXml.Document.Data;
        
        // Generate signed XML
        const signedXML = digitalSignature.createSignedXML(dataToSign);
        res.status(200).send(signedXML);
    } catch (error) {
        logger.error('Error in /api/sign:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Single endpoint for all frontend requests
router.post('/loan', apiController.processRequest);

// Temporary endpoint to check ClientType codes
router.get('/client-types', async (req, res) => {
    try {
        const response = await api.get('/v1/codes/ClientType/codevalues');
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Generic endpoint to manually trigger supported outgoing messages from admin portal
const outgoingMessagesController = require('../controllers/outgoingMessagesController');
router.post('/outgoing-message', outgoingMessagesController.triggerOutgoingMessage);

// Endpoint to manually trigger LOAN_STATUS_REQUEST from admin portal
router.post('/loan-status-request', loanStatusController.triggerLoanStatusRequest);

module.exports = router;



