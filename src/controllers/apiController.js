const xml2js = require('xml2js');
const api = require("../services/cbs.api").maker;
const { validateXML, validateMessageType } = require('../validations/xmlValidator');
const { forwardToThirdParty } = require('../services/thirdPartyService');
const digitalSignature = require('../utils/signatureUtils');
const logger = require('../utils/logger');
const { sendCallback } = require('../utils/callbackUtils');
const { sendErrorResponse } = require('../utils/responseUtils');
const { LoanCalculate, CreateTopUpLoanOffer, CreateTakeoverLoanOffer, CreateLoanOffer } = require('../services/loanService');
const LoanMappingService = require('../services/loanMappingService');
const ClientService = require('../services/clientService');
const cbsApi = require('../services/cbs.api');
const { formatDateForMifos, formatDateForUTUMISHI, formatDateTimeForUTUMISHI } = require('../utils/dateUtils');
const AuditLog = require('../models/AuditLog');
const { getMessageId } = require('../utils/messageIdGenerator');
const LOAN_CONSTANTS = require('../utils/loanConstants');
const LoanCalculations = require('../utils/loanCalculations');
const { API_ENDPOINTS } = require('../services/cbs.endpoints');
const { rejectLoan, cancelLoan, completeLoan, setWaitingForLiquidation } = require('../utils/loanStatusHelpers');

// Enhanced CBS services
const { authManager, healthMonitor, errorHandler, requestManager } = cbsApi;
const { generateLoanNumber, generateFSPReferenceNumber } = require('../utils/loanUtils');

// Import metrics tracking
const { trackLoanMessage, trackLoanError } = require('../middleware/metricsMiddleware');

const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    normalize: true,
    trim: true
});

const builder = new xml2js.Builder({
    rootName: 'Document',
    renderOpts: { pretty: false }
});

/**
 * Convert JSON request body to XML format
 * @param {Object} jsonData - JSON data to convert
 * @returns {string} XML string
 */
function convertProductJSONToXML(jsonData) {
    try {
        // Use the builder to convert JSON to XML
        return builder.buildObject(jsonData);
    } catch (error) {
        logger.error('Error converting JSON to XML:', error);
        throw new Error(`Failed to convert JSON to XML: ${error.message}`);
    }
}

// Import handlers
const handleMifosWebhook = require('./handlers/mifosWebhookHandler');
const handleLoanChargesRequest = require('./handlers/loanChargesHandler');
const handleLoanOfferRequest = require('./handlers/loanOfferHandler');
const handleLoanRestructureRequest = require('./handlers/loanRestructureHandler');
const handleLoanRestructureBalanceRequest = require('./handlers/loanRestructureBalanceHandler');
const handleLoanRestructureAffordabilityRequest = require('./handlers/loanRestructureAffordabilityHandler');
const handleTopUpPayOffBalanceRequest = require('./handlers/topUpBalanceHandler');
const handleTakeoverPayOffBalanceRequest = require('./handlers/takeoverBalanceHandler');
const handleTopUpOfferRequest = require('./handlers/topUpOfferHandler');
const handleLoanTakeoverOfferRequest = require('./handlers/takeoverOfferHandler');
const handleLoanCancellation = require('./handlers/cancellationHandler');
const {
    handleTakeoverPaymentNotification,
    handlePaymentAcknowledgmentNotification
} = require('./handlers/paymentHandler');

// Export all functions before they are used
exports.processRequest = async (req, res) => {
    const contentType = req.get('Content-Type');
    logger.info('Processing request in AUTO-SIGNATURE mode', { contentType });
    logger.debug('Request details', { 
        contentType, 
        bodyType: typeof req.body, 
        body: req.body 
    });

    try {
        let xmlData;
        let parsedData;

        if (contentType && contentType.includes('application/json')) {
            logger.info('🔄 Converting JSON to XML...');
            if (!req.body || typeof req.body !== 'object') {
                return sendErrorResponse(res, '8001', 'Invalid JSON data', 'json', null);
            }
            xmlData = convertProductJSONToXML(req.body);
            try {
                parsedData = await parser.parseStringPromise(xmlData);
            } catch (parseError) {
                return sendErrorResponse(res, '8001', 'Failed to convert JSON to XML: ' + parseError.message, 'json', null);
            }
        } else if (contentType && (contentType.includes('application/xml') || contentType.includes('text/xml'))) {
            logger.info('Processing XML directly...');
            xmlData = req.body;
            if (!xmlData) {
                return sendErrorResponse(res, '8001', 'XML data is required', 'xml', parsedData);
            }
            try {
                parsedData = await parser.parseStringPromise(xmlData);
                const debugSender = parsedData?.Document?.Data?.Header?.Sender;
                logger.info('DEBUG: Parsed <Sender> from request:', debugSender);
                const TypeMessage = parsedData?.Document?.Data.Header?.MessageType;
                
                // Track incoming message
                if (TypeMessage && typeof TypeMessage === 'string' && TypeMessage.trim()) {
                    trackLoanMessage(TypeMessage.trim(), 'received');
                }
                
                switch (TypeMessage) {
                    case 'LOAN_CHARGES_REQUEST':
                        trackLoanMessage('LOAN_CHARGES_REQUEST', 'processing');
                        return await handleLoanChargesRequest(parsedData, res);
                    case 'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST':
                        trackLoanMessage('LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST', 'processing');
                        return await handleLoanRestructureAffordabilityRequest(parsedData, res);
                    case 'LOAN_RESTRUCTURE_BALANCE_REQUEST':
                        trackLoanMessage('LOAN_RESTRUCTURE_BALANCE_REQUEST', 'processing');
                        return await handleLoanRestructureBalanceRequest(parsedData, res);
                    case 'LOAN_RESTRUCTURE_REQUEST':
                        trackLoanMessage('LOAN_RESTRUCTURE_REQUEST', 'processing');
                        return await handleLoanRestructureRequest(parsedData, res);
                    case 'LOAN_RESTRUCTURE_REJECTION':
                        trackLoanMessage('LOAN_RESTRUCTURE_REJECTION', 'processing');
                        return await handleLoanRestructureRejection(parsedData, res);
                    case 'LOAN_OFFER_REQUEST':
                        trackLoanMessage('LOAN_OFFER_REQUEST', 'processing');
                        return await handleLoanOfferRequest(parsedData, res);
                    case 'LOAN_FINAL_APPROVAL_NOTIFICATION':
                        trackLoanMessage('LOAN_FINAL_APPROVAL_NOTIFICATION', 'processing');
                        return await handleLoanFinalApproval(parsedData, res);
                    case 'LOAN_CANCELLATION_NOTIFICATION':
                        trackLoanMessage('LOAN_CANCELLATION_NOTIFICATION', 'processing');
                        return await handleLoanCancellation(parsedData, res);
                    case 'TOP_UP_PAY_0FF_BALANCE_REQUEST':
                        trackLoanMessage('TOP_UP_PAY_0FF_BALANCE_REQUEST', 'processing');
                        return await handleTopUpPayOffBalanceRequest(parsedData, res);
                    case 'TOP_UP_OFFER_REQUEST':
                        trackLoanMessage('TOP_UP_OFFER_REQUEST', 'processing');
                        return await handleTopUpOfferRequest(parsedData, res);
                    case 'TAKEOVER_PAY_OFF_BALANCE_REQUEST':
                        trackLoanMessage('TAKEOVER_PAY_OFF_BALANCE_REQUEST', 'processing');
                        return await handleTakeoverPayOffBalanceRequest(parsedData, res);
                    case 'LOAN_TAKEOVER_OFFER_REQUEST':
                        trackLoanMessage('LOAN_TAKEOVER_OFFER_REQUEST', 'processing');
                        return await handleLoanTakeoverOfferRequest(parsedData, res);
                    case 'TAKEOVER_PAYMENT_NOTIFICATION':
                        trackLoanMessage('TAKEOVER_PAYMENT_NOTIFICATION', 'processing');
                        return await handleTakeoverPaymentNotification(parsedData, res);
                    case 'TAKEOVER_DISBURSEMENT_NOTIFICATION':
                        trackLoanMessage('TAKEOVER_DISBURSEMENT_NOTIFICATION', 'processing');
                        return await handleTakeoverDisbursementNotification(parsedData, res);
                    case 'PAYMENT_ACKNOWLEDGMENT_NOTIFICATION':
                        trackLoanMessage('PAYMENT_ACKNOWLEDGMENT_NOTIFICATION', 'processing');
                        return await handlePaymentAcknowledgmentNotification(parsedData, res);

                    default:
                        return await forwardToThirdParty(parsedData.Document.Data, res, contentType);
                }
            } catch (parseError) {
                return sendErrorResponse(res, '8001', 'Invalid XML format: ' + parseError.message, 'xml', parsedData);
            }
        } else {
            return sendErrorResponse(res, '8001', 'Unsupported Content-Type. Use application/json or application/xml', 'json', null);
        }
    } catch (error) {
        logger.error('Controller error:', error);
        // Safely track error with validation
        const errorMessage = error?.message || 'Unknown error';
        trackLoanError(errorMessage.substring(0, 100), 'controller'); // Limit error message length
        const contentType = req.get('Content-Type');
        return sendErrorResponse(res, '8011', 'Error processing request: ' + errorMessage, contentType.includes('json') ? 'json' : 'xml', null);
    }
};

// Helper function to calculate monthly installment
// DEPRECATED: Use LoanCalculations.calculateEMI instead

// Handler functions have been extracted to separate files in ./handlers/
// - handleTopUpPayOffBalanceRequest -> handlers/topUpBalanceHandler.js
// - handleTakeoverPayOffBalanceRequest -> handlers/takeoverBalanceHandler.js
// - handleTopUpOfferRequest -> handlers/topUpOfferHandler.js
// - handleLoanTakeoverOfferRequest -> handlers/takeoverOfferHandler.js
// - handleTakeoverPaymentNotification -> handlers/paymentHandler.js
// - handlePaymentAcknowledgmentNotification -> handlers/paymentHandler.js

const handleLoanRestructureRejection = async (parsedData, res) => {
    try {
        logger.info('Processing LOAN_RESTRUCTURE_REJECTION...');
        
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;
        
        // Extract request data
        const applicationNumber = messageDetails.ApplicationNumber;
        const reason = messageDetails.Reason;
        const fspReferenceNumber = messageDetails.FSPReferenceNumber;
        const loanNumber = messageDetails.LoanNumber;
        
        logger.info('Loan restructure rejection details:', {
            applicationNumber,
            fspReferenceNumber,
            loanNumber,
            reason
        });

        // Validate required fields
        if (!applicationNumber) {
            logger.error('Missing required field: ApplicationNumber');
            return sendErrorResponse(res, '8003', 'Missing required field: ApplicationNumber', 'xml', parsedData);
        }

        // Find loan mapping by ApplicationNumber (only active loans)
        let loanMapping;
        try {
            loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber, false);
        } catch (error) {
            logger.info('Active loan mapping not found for restructure rejection:', { applicationNumber });
            // If no active mapping exists, still acknowledge
            const responseData = {
                Data: {
                    Header: {
                        "Sender": process.env.FSP_NAME || "ZE DONE",
                        "Receiver": header.Sender,
                        "FSPCode": process.env.FSP_CODE || "FL8090", 
                        "MsgId": getMessageId("RESPONSE"),
                        "MessageType": "RESPONSE"
                    },
                    MessageDetails: {
                        "ResponseCode": "8000",
                        "Description": `Loan restructure rejection acknowledged for application: ${applicationNumber}. No active loan found.`
                    }
                }
            };

            const responseXML = digitalSignature.createSignedXML(responseData.Data);
            res.set('Content-Type', 'application/xml');
            return res.send(responseXML);
        }

        logger.info('Found loan mapping for restructure rejection:', {
            id: loanMapping._id,
            status: loanMapping.status,
            mifosLoanId: loanMapping.mifosLoanId,
            essApplicationNumber: loanMapping.essApplicationNumber
        });

        // Check if loan is in a restructurable state
        const allowedStatuses = ['RESTRUCTURE_PENDING', 'RESTRUCTURE_IN_PROGRESS', 'DISBURSED', 'ACTIVE'];
        
        if (!allowedStatuses.includes(loanMapping.status)) {
            logger.warn('Loan restructure rejection for unexpected status (processing anyway):', { 
                status: loanMapping.status,
                applicationNumber 
            });
        }

        // Update loan mapping status to RESTRUCTURE_REJECTED
        const updateResult = await LoanMappingService.updateStatus(
            applicationNumber,
            'RESTRUCTURE_REJECTED',
            {
                rejectionReason: reason || 'Loan restructure rejected by ESS',
                rejectedAt: new Date(),
                rejectedBy: 'ESS_UTUMISHI',
                fspReferenceNumber: fspReferenceNumber || loanMapping.fspReferenceNumber,
                loanNumber: loanNumber
            }
        );

        logger.info('Loan mapping updated to RESTRUCTURE_REJECTED:', {
            applicationNumber,
            updateResult
        });

        // Send success acknowledgment
        const responseData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": header.Sender,
                    "FSPCode": header.FSPCode,
                    "MsgId": getMessageId("RESPONSE"),
                    "MessageType": "RESPONSE"
                },
                MessageDetails: {
                    "ResponseCode": "8000",
                    "Description": "Loan restructure rejection processed successfully"
                }
            }
        };

        logger.info('Sending restructure rejection acknowledgment:', responseData.Data.MessageDetails);
        
        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        res.status(200).send(signedResponse);

    } catch (error) {
        logger.error('Error processing LOAN_RESTRUCTURE_REJECTION:', error);
        return sendErrorResponse(res, '8002', `Processing error: ${error.message}`, 'xml', parsedData);
    }
};


const handleLoanFinalApproval = async (parsedData, res) => {
    let responseSent = false;
    try {
        logger.info('Processing LOAN_FINAL_APPROVAL_NOTIFICATION...');

        // Extract message details
        const messageDetails = parsedData.Document.Data.MessageDetails;
        const header = parsedData.Document.Data.Header;

        // Validate required fields
        if (!messageDetails.LoanNumber || !messageDetails.Approval || !messageDetails.ApplicationNumber) {
            throw new Error('Missing required fields: LoanNumber, Approval, and ApplicationNumber are required');
        }

        // Validate Approval value
        if (!['APPROVED', 'REJECTED'].includes(messageDetails.Approval)) {
            throw new Error('Invalid Approval value: Must be either "APPROVED" or "REJECTED"');
        }

        // Send immediate acknowledgment for LOAN_FINAL_APPROVAL_NOTIFICATION
        const responseData = {
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
                    "Description": "Success"
                }
            }
        };
        
        // Send acknowledgment response
        if (!responseSent) {
            const signedResponse = digitalSignature.createSignedXML(responseData.Data);
            res.status(200).send(signedResponse);
            responseSent = true;

            // Log the client creation attempt
            logger.info('Creating client in CBS with data:', {
                firstname: messageDetails.FirstName,
                middlename: messageDetails.MiddleName,
                lastname: messageDetails.LastName,
                externalId: messageDetails.NIN,
                mobileNo: messageDetails.MobileNo,
                dateOfBirth: messageDetails.DateOfBirth,
                gender: messageDetails.Sex,
                address: messageDetails.PhysicalAddress,
                applicationNumber: messageDetails.ApplicationNumber
            });
        }

        // Process the request asynchronously
        setImmediate(async () => {
            try {
                // Try to retrieve existing loan mapping, or create a new one
                // IMPORTANT: For restructures, the ApplicationNumber is NEW but the loan mapping uses the OLD one
                // We need to search by multiple identifiers
                let existingMapping;
                try {
                    // First, try by ApplicationNumber
                    existingMapping = await LoanMappingService.getByEssApplicationNumber(messageDetails.ApplicationNumber, false);
                    
                    // If not found, try by restructureApplicationNumber (for restructures)
                    if (!existingMapping && messageDetails.ApplicationNumber) {
                        existingMapping = await LoanMapping.findOne({
                            restructureApplicationNumber: messageDetails.ApplicationNumber,
                            status: { $nin: ['CANCELLED', 'REJECTED', 'CLOSED'] }
                        }).lean();
                        if (existingMapping) {
                            logger.info(`✅ Found loan mapping by restructureApplicationNumber: ${messageDetails.ApplicationNumber}`);
                        }
                    }
                    
                    // If still not found, try by LoanNumber or FSPReferenceNumber
                    if (!existingMapping && (messageDetails.LoanNumber || messageDetails.FSPReferenceNumber)) {
                        existingMapping = await LoanMapping.findOne({
                            $or: [
                                { newLoanNumber: messageDetails.LoanNumber },
                                { essLoanNumberAlias: messageDetails.LoanNumber },
                                { newFspReferenceNumber: messageDetails.FSPReferenceNumber },
                                { fspReferenceNumber: messageDetails.FSPReferenceNumber }
                            ],
                            status: { $nin: ['CANCELLED', 'REJECTED', 'CLOSED'] }
                        }).lean();
                        if (existingMapping) {
                            logger.info(`✅ Found loan mapping by LoanNumber/FSPReferenceNumber: ${messageDetails.LoanNumber}`);
                        }
                    }
                    
                    if (!existingMapping) {
                        // Check if there's a cancelled/rejected mapping (for logging only)
                        const inactiveMapping = await LoanMappingService.getByEssApplicationNumber(messageDetails.ApplicationNumber, true);
                        if (inactiveMapping) {
                            logger.info(`ℹ️ Found ${inactiveMapping.status} loan for ${messageDetails.ApplicationNumber}. Treating as new application.`);
                        }
                    }
                } catch (error) {
                    logger.warn(`⚠️ No existing loan mapping found for ${messageDetails.ApplicationNumber}, will create new one`);
                    existingMapping = null;
                }
                
                // Create loan mapping data
                const loanMappingData = {
                    essLoanNumberAlias: messageDetails.LoanNumber,
                    fspReferenceNumber: messageDetails.FSPReferenceNumber || null,
                    status: messageDetails.Approval === 'APPROVED' ? 'FINAL_APPROVAL_RECEIVED' : 'REJECTED',
                    essApplicationNumber: messageDetails.ApplicationNumber,
                    essCheckNumber: messageDetails.FSPReferenceNumber || messageDetails.CheckNumber,
                    productCode: '17',
                    requestedAmount: messageDetails.LoanAmount || messageDetails.RequestedAmount || 5000000,
                    tenure: messageDetails.LoanTenure || messageDetails.Tenure || 60,
                    finalApprovalReceivedAt: new Date().toISOString()
                };
                
                // Handle rejection with proper actor tracking
                if (messageDetails.Approval === 'REJECTED') {
                    const reason = messageDetails.Reason || 'Application rejected by employer';
                    if (existingMapping) {
                        await rejectLoan(existingMapping, 'EMPLOYER', reason);
                        logger.info('✅ Loan rejected with actor tracking:', {
                            applicationNumber: messageDetails.ApplicationNumber,
                            rejectedBy: 'EMPLOYER',
                            reason: reason
                        });
                    } else {
                        // For new mapping, set rejection info in metadata
                        loanMappingData.rejectedBy = 'EMPLOYER';
                        loanMappingData.rejectionReason = reason;
                    }
                }

                        // If approved, create client in CBS and create loan
                        if (messageDetails.Approval === 'APPROVED') {
                            // Get original message type to determine loan processing flow
                            const originalMessageType = existingMapping?.originalMessageType;
                            
                            logger.info('🔍 Determined loan type:', {
                                originalMessageType: originalMessageType,
                                applicationNumber: messageDetails.ApplicationNumber,
                                fallbackChecks: {
                                    hasRestructureFlag: !!(existingMapping?.isRestructure || existingMapping?.restructureRequested),
                                    hasExistingLoanId: !!(existingMapping?.metadata?.loanData?.existingLoanId || existingMapping?.mifosLoanId)
                                }
                            });
                            
                            // Process based on original message type
                            switch (originalMessageType) {
                                case 'LOAN_RESTRUCTURE_REQUEST':
                                    logger.info('🔄 Processing LOAN_RESTRUCTURE_REQUEST - will call MIFOS reschedule API');
                                    logger.info('Restructure details:', {
                                        mifosLoanId: existingMapping?.mifosLoanId,
                                        newTenure: existingMapping?.newTenure,
                                        newRequestedAmount: existingMapping?.newRequestedAmount
                                    });
                                    
                                    try {
                                        // Call MIFOS reschedule API
                                        const reschedulePayload = {
                                            dateFormat: "dd MMMM yyyy",
                                            locale: "en",
                                            rescheduleFromDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
                                            rescheduleReasonId: 1,
                                            submittedOnDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
                                            adjustedDueDate: new Date(new Date().setMonth(new Date().getMonth() + existingMapping.newTenure)).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
                                            graceOnPrincipal: 0,
                                            graceOnInterest: 0,
                                            extraTerms: 0,
                                            rescheduleReasonComment: `Loan restructure approved. New tenure: ${existingMapping.newTenure} months, New amount: ${existingMapping.newRequestedAmount}`
                                        };

                                        logger.info('📞 Calling MIFOS reschedule API with payload:', JSON.stringify(reschedulePayload, null, 2));
                                        const rescheduleResponse = await api.post(
                                            `/v1/loans/${existingMapping.mifosLoanId}/schedule`,
                                            reschedulePayload
                                        );

                                        logger.info('✅ MIFOS reschedule created:', {
                                            resourceId: rescheduleResponse.data.resourceId,
                                            loanId: rescheduleResponse.data.loanId
                                        });

                                        // Update loan mapping with reschedule details
                                        loanMappingData.rescheduleId = rescheduleResponse.data.resourceId;
                                        loanMappingData.status = 'RESTRUCTURED';
                                        loanMappingData.restructuredAt = new Date().toISOString();

                                        // Skip loan creation for restructure
                                        logger.info('✅ Loan restructure completed, skipping new loan creation');
                                        
                                    } catch (rescheduleError) {
                                        logger.error('❌ Error calling MIFOS reschedule API:', rescheduleError);
                                        throw rescheduleError;
                                    }
                                    break;
                                    
                                case 'TOP_UP_OFFER_REQUEST':
                                    logger.info('🔄 Processing TOP_UP_OFFER_REQUEST - will create top-up loan in CBS');
                                    const topUpExistingLoanId = existingMapping?.metadata?.loanData?.existingLoanId || 
                                                              existingMapping?.metadata?.existingLoanId ||
                                                              existingMapping?.mifosLoanId;
                                    
                                    logger.info('Top-up details:', {
                                        existingLoanId: topUpExistingLoanId,
                                        mifosClientId: existingMapping?.mifosClientId
                                    });
                                    
                                    // Mark this so we create the loan with topup=true parameter
                                    loanMappingData.isTopUp = true;
                                    loanMappingData.existingLoanId = topUpExistingLoanId;
                                    // Fall through to loan creation
                                    break;
                                    
                                case 'LOAN_TAKEOVER_OFFER_REQUEST':
                                    logger.info('🔄 Processing LOAN_TAKEOVER_OFFER_REQUEST - will create takeover loan in CBS');
                                    const takeoverExistingLoanId = existingMapping?.metadata?.loanData?.existingLoanId || 
                                                                 existingMapping?.mifosLoanId;
                                    
                                    logger.info('Takeover details:', {
                                        existingLoanId: takeoverExistingLoanId,
                                        mifosClientId: existingMapping?.mifosClientId
                                    });
                                    
                                    loanMappingData.isTakeover = true;
                                    loanMappingData.existingLoanId = takeoverExistingLoanId;
                                    // Fall through to loan creation
                                    break;
                                    
                                case 'LOAN_OFFER_REQUEST':
                                    logger.info('✅ Processing LOAN_OFFER_REQUEST - will create new loan in CBS');
                                    // Standard new loan - no special flags needed
                                    break;
                                    
                                default:
                                    // Fallback for legacy records without originalMessageType
                                    logger.warn('⚠️ No originalMessageType found, using legacy detection logic');
                                    const isRestructure = existingMapping?.isRestructure || existingMapping?.restructureRequested;
                                    const existingLoanId = existingMapping?.metadata?.loanData?.existingLoanId || 
                                                         existingMapping?.metadata?.existingLoanId ||
                                                         existingMapping?.mifosLoanId;
                                    
                                    if (isRestructure) {
                                        logger.info('🔄 Legacy: Detected restructure via flags');
                                        // Handle as restructure (but this shouldn't happen with new code)
                                    } else if (existingLoanId) {
                                        logger.info('🔄 Legacy: Detected top-up via existing loan ID');
                                        loanMappingData.isTopUp = true;
                                        loanMappingData.existingLoanId = existingLoanId;
                                    } else {
                                        logger.info('✅ Legacy: Treating as new loan');
                                    }
                                    break;
                            }
                            
                            // Only create client/loan if NOT a restructure
                            if (originalMessageType !== 'LOAN_RESTRUCTURE_REQUEST') {
                                // Try to get client data from existing mapping or use message details
                                const storedClientData = existingMapping?.metadata?.clientData;
                            const clientData = storedClientData ? {
                                externalId: storedClientData.nin || messageDetails.FSPReferenceNumber,
                                nin: storedClientData.nin,
                                firstname: storedClientData.firstName,
                                middlename: storedClientData.middleName,
                                lastname: storedClientData.lastName,
                                mobileNo: storedClientData.mobileNumber,
                                sex: storedClientData.sex,
                                dateOfBirth: storedClientData.dateOfBirth || '1990-01-01',
                                employmentDate: storedClientData.employmentDate,
                                maritalStatus: storedClientData.maritalStatus || 'Single',
                                physicalAddress: storedClientData.physicalAddress,
                                emailAddress: storedClientData.emailAddress,
                                applicationNumber: storedClientData.applicationNumber,
                                checkNumber: storedClientData.checkNumber,
                                bankAccountNumber: storedClientData.bankAccountNumber,
                                swiftCode: storedClientData.swiftCode
                            } : {
                                externalId: messageDetails.NIN || messageDetails.FSPReferenceNumber,
                                nin: messageDetails.NIN || messageDetails.FSPReferenceNumber,
                                firstname: messageDetails.FirstName || 'ESS',
                                middlename: messageDetails.MiddleName || 'Application',
                                lastname: messageDetails.LastName || messageDetails.ApplicationNumber,
                                mobileNo: messageDetails.MobileNo || messageDetails.MobileNumber,
                                sex: messageDetails.Sex || 'M',
                                dateOfBirth: messageDetails.DateOfBirth || '1990-01-01',
                                employmentDate: messageDetails.EmploymentDate,
                                maritalStatus: messageDetails.MaritalStatus || 'Single',
                                physicalAddress: messageDetails.PhysicalAddress,
                                emailAddress: messageDetails.EmailAddress,
                                applicationNumber: messageDetails.ApplicationNumber,
                                checkNumber: messageDetails.CheckNumber || messageDetails.FSPReferenceNumber
                            };
                            logger.info('Client data for CBS creation:', JSON.stringify(clientData, null, 2));
                            
                            try {
                                const potentialNIN = clientData?.nin || clientData?.NIN || clientData?.nationalId;
                                logger.info('Potential NIN values:', {
                                    fromNIN: clientData?.NIN,
                                    fromNin: clientData?.nin,
                                    fromNationalId: clientData?.nationalId,
                                    selected: potentialNIN
                                });

                                // Ensure we have NIN
                                if (!potentialNIN) {
                                    logger.warn('⚠️ No NIN found in client data');
                                    throw new Error('National ID Number (NIN) is required for client creation');
                                }

                                // First check if client exists by NIN
                                logger.info('🔍 Checking if client exists with NIN:', potentialNIN);
                                const existingClientByNin = await ClientService.searchClientByExternalId(potentialNIN);
                                logger.info('Search result:', { 
                                    totalRecords: existingClientByNin?.totalFilteredRecords || 0,
                                    found: existingClientByNin?.pageItems?.length || 0 
                                });
                                
                                let clientId;
                                if (!existingClientByNin?.pageItems?.length) {
                                    // Create new client in CBS
                                    logger.info(`Creating new client: ${clientData.fullName || clientData.firstName + ' ' + clientData.lastName}`);
                                    
                                    // Prepare client creation payload
                                    const fullName = clientData.fullName || `${clientData.firstName || ''} ${clientData.middleName || ''} ${clientData.lastName || ''}`.trim();
                                    const mobileNumber = clientData.mobileNumber || clientData.mobileNo || clientData.MobileNumber;
                                    
                                    const date = new Date();
                                    const formattedDate = date.toLocaleDateString('en-GB', { 
                                        day: '2-digit', 
                                        month: 'long', 
                                        year: 'numeric' 
                                    });
                                    
                                    // Format dates properly
                                    const clientPayload = {
                                        officeId: 1,
                                        firstname: clientData.firstname || clientData.FirstName,
                                        middlename: clientData.middlename || clientData.MiddleName,
                                        lastname: clientData.lastname || clientData.LastName,
                                        externalId: potentialNIN,
                                        dateFormat: "yyyy-MM-dd",
                                        locale: "en",
                                        active: true,
                                        activationDate: new Date().toISOString().split('T')[0],
                                        dateOfBirth: clientData.DateOfBirth || clientData.dateOfBirth,
                                        genderId: clientData.Sex === 'M' || clientData.sex === 'M' ? 15 : 16,
                                        clientTypeId: 17,
                                        submittedOnDate: new Date().toISOString().split('T')[0],
                                        legalFormId: 1
                                    };
                                    
                                    logger.info('📄 Creating client with payload:', JSON.stringify(clientPayload, null, 2));
                                    const newClient = await ClientService.createClient(clientPayload);

                                    if (newClient && newClient.data && newClient.data.clientId) {
                                        clientId = newClient.data.clientId;
                                        logger.info(`✅ Client created in CBS with ID: ${clientId}`);
                                    } else {
                                        logger.error('❌ Client creation failed - no clientId in response');
                                    }
                                } else {
                                    clientId = existingClientByNin.pageItems[0].id;
                                    logger.info(`✅ Existing client found with ID: ${clientId}`);
                                }

                                if (clientId) {
                                    // Get loan amount and tenure from existing mapping or message details
                                    const loanAmount = existingMapping?.requestedAmount || 
                                                     existingMapping?.metadata?.loanData?.requestedAmount ||
                                                     messageDetails.LoanAmount || 
                                                     messageDetails.RequestedAmount || 
                                                     5000000;
                                    const loanTenure = existingMapping?.tenure ||
                                                     existingMapping?.metadata?.loanData?.tenure ||
                                                     messageDetails.LoanTenure || 
                                                     messageDetails.Tenure || 
                                                     60;
                                    
                                    logger.info(`Using loan amount: ${loanAmount}, tenure: ${loanTenure}`);
                                    
                                    // Check if this is a top-up or takeover loan
                                    const isTopUp = loanMappingData.isTopUp === true;
                                    const isTakeover = loanMappingData.isTakeover === true;
                                    const existingLoanId = loanMappingData.existingLoanId;
                                    const takeOverAmount = parseFloat(existingMapping?.metadata?.loanData?.takeOverAmount || 0);
                                    
                                    if (isTopUp && existingLoanId) {
                                        logger.info(`🔄 Creating TOP-UP loan linked to existing loan ${existingLoanId}`);
                                    }
                                    
                                    if (isTakeover && takeOverAmount > 0) {
                                        logger.info(`🔄 Creating TAKEOVER loan - Total: ${loanAmount}, TakeOver Amount: ${takeOverAmount}, Net to Customer: ${loanAmount - takeOverAmount}`);
                                    }
                                    
                                    // Create loan in CBS
                                    const loanPayload = {
                                        clientId: clientId,
                                        productId: 17, // ESS Loan product
                                        principal: loanAmount.toString(),
                                        loanTermFrequency: parseInt(loanTenure),
                                        loanTermFrequencyType: 2, // Months
                                        loanType: "individual",
                                        numberOfRepayments: parseInt(loanTenure),
                                        repaymentEvery: 1,
                                        repaymentFrequencyType: 2, // Monthly
                                        interestRatePerPeriod: 24, // 24% per year (matching product config)
                                        interestRateFrequencyType: 3, // Per year
                                        amortizationType: 1, // Equal installments
                                        interestType: 0, // Declining balance
                                        interestCalculationPeriodType: 1, // Same as repayment
                                        transactionProcessingStrategyCode: "mifos-standard-strategy",
                                        expectedDisbursementDate: new Date().toISOString().split('T')[0],
                                        submittedOnDate: new Date().toISOString().split('T')[0],
                                        dateFormat: "yyyy-MM-dd",
                                        locale: "en",
                                        charges: [], // Empty charges array to avoid MIFOS NPE bug
                                        // Add top-up parameters if this is a top-up loan
                                        ...(isTopUp && existingLoanId ? {
                                            isTopup: true,
                                            loanIdToClose: existingLoanId
                                        } : {})
                                    };
                                    
                                    logger.info('Creating loan with payload:', JSON.stringify(loanPayload, null, 2));

                                    // Create loan
                                    logger.info('Creating loan with payload:', JSON.stringify(loanPayload, null, 2));
                                    const loanResponse = await api.post('/v1/loans', loanPayload);

                                    if (loanResponse.data && loanResponse.data.loanId) {
                                        const loanId = loanResponse.data.loanId;
                                        logger.info(`Loan created successfully with ID: ${loanId}`);

                                        // Approve loan
                                        const approvePayload = {
                                            approvedOnDate: new Date().toISOString().split('T')[0],
                                            dateFormat: "yyyy-MM-dd",
                                            locale: "en"
                                        };

                                        await api.post(`/v1/loans/${loanId}?command=approve`, approvePayload);
                                        logger.info(`Loan ${loanId} approved successfully`);

                                        // Disburse loan
                                        // For takeover loans, only disburse net amount (LoanAmount - TakeOverAmount) to customer
                                        // The TakeOverAmount will be paid to FSP1 separately via TAKEOVER_DISBURSEMENT_NOTIFICATION
                                        let netDisbursementAmount = loanAmount;
                                        
                                        if (isTakeover && takeOverAmount > 0) {
                                            netDisbursementAmount = loanAmount - takeOverAmount;
                                            logger.info(`💰 Takeover loan disbursement - Net to customer: ${netDisbursementAmount} (Principal: ${loanAmount} - TakeOver: ${takeOverAmount})`);
                                        }
                                        
                                        const disbursePayload = {
                                            actualDisbursementDate: new Date().toISOString().split('T')[0],
                                            transactionAmount: netDisbursementAmount.toString(),
                                            dateFormat: "yyyy-MM-dd",
                                            locale: "en",
                                            note: isTakeover ? `Takeover loan disbursement. Net amount after FSP1 settlement: ${netDisbursementAmount}` : undefined
                                        };

                                        await api.post(`/v1/loans/${loanId}?command=disburse`, disbursePayload);
                                        logger.info(`Loan ${loanId} disbursed successfully with amount: ${netDisbursementAmount}`);
                                        
                                        // Store takeover details for later use in TAKEOVER_DISBURSEMENT_NOTIFICATION
                                        if (isTakeover && takeOverAmount > 0) {
                                            loanMappingData.takeoverDetails = {
                                                totalLoanAmount: loanAmount,
                                                takeOverAmount: takeOverAmount,
                                                netDisbursedToCustomer: netDisbursementAmount,
                                                fsp1LoanNumber: existingMapping?.metadata?.loanData?.fsp1LoanNumber,
                                                fsp1BankAccount: existingMapping?.metadata?.loanData?.fsp1BankAccount,
                                                fsp1BankAccountName: existingMapping?.metadata?.loanData?.fsp1BankAccountName,
                                                fsp1SwiftCode: existingMapping?.metadata?.loanData?.fsp1SwiftCode
                                            };
                                        }

                                        // Update loan mapping with loan details
                                        loanMappingData.mifosClientId = clientId;
                                        loanMappingData.mifosLoanId = loanId;
                                        loanMappingData.metadata = {
                                            ...existingMapping.metadata,
                                            clientId: clientId,
                                            clientCreatedAt: new Date().toISOString(),
                                            loanId: loanId,
                                            loanCreatedAt: new Date().toISOString(),
                                            loanDisbursedAt: new Date().toISOString()
                                        };
                                    }
                                }
                            } catch (error) {
                                logger.error('Error in loan creation process:', error);
                                // Continue with loan mapping update even if process fails
                            }
                            } // End of restructure check
                        }
                
                // Use the already retrieved existing mapping
                if (existingMapping) {
                    // Keep the requested amount from existing data
                    loanMappingData.requestedAmount = existingMapping.requestedAmount || loanMappingData.requestedAmount;

                    // Also keep any metadata
                    loanMappingData.metadata = {
                        ...existingMapping.metadata,
                        ...loanMappingData.metadata,
                        finalApprovalDetails: {
                            applicationNumber: messageDetails.ApplicationNumber,
                            loanNumber: messageDetails.LoanNumber,
                            fspReferenceNumber: messageDetails.FSPReferenceNumber,
                            approval: messageDetails.Approval,
                            reason: messageDetails.Reason
                        }
                    };
                } else {
                    logger.warn('⚠️ No existing loan mapping found, creating new one with default values');
                    loanMappingData.metadata = {
                        createdVia: 'LOAN_FINAL_APPROVAL_without_prior_offer',
                        finalApprovalDetails: {
                            applicationNumber: messageDetails.ApplicationNumber,
                            loanNumber: messageDetails.LoanNumber,
                            fspReferenceNumber: messageDetails.FSPReferenceNumber,
                            approval: messageDetails.Approval,
                            reason: messageDetails.Reason
                        }
                    };
                }

                // Default requested amount if not present
                if (!loanMappingData.requestedAmount) {
                    loanMappingData.requestedAmount = messageDetails.requestedAmount || messageDetails.RequestedAmount || messageDetails.LoanAmount || "5000000";
                }
                
                // Update or create loan mapping in database
                const savedMapping = await LoanMappingService.updateLoanMapping(loanMappingData);
                logger.info('✅ Updated loan mapping:', {
                    applicationNumber: savedMapping.essApplicationNumber,
                    loanNumber: savedMapping.essLoanNumberAlias,
                    requestedAmount: savedMapping.requestedAmount,
                    clientId: savedMapping.mifosClientId,
                    loanId: savedMapping.mifosLoanId,
                    status: savedMapping.status
                });

                if (messageDetails.Approval === 'APPROVED') {
                    try {
                        // Update loan status to DISBURSED
                        const disbursementAmount = messageDetails.DisbursementAmount || messageDetails.LoanAmount || savedMapping.requestedAmount;
                        logger.info('💰 Disbursement amount:', disbursementAmount);
                        
                        const updatedMapping = await LoanMappingService.updateLoanMapping({
                            essApplicationNumber: savedMapping.essApplicationNumber,
                            essLoanNumberAlias: savedMapping.essLoanNumberAlias,
                            fspReferenceNumber: savedMapping.fspReferenceNumber,
                            mifosClientId: savedMapping.mifosClientId,
                            mifosLoanId: savedMapping.mifosLoanId,
                            status: 'DISBURSED',
                            disbursedAmount: disbursementAmount,
                            disbursedAt: new Date().toISOString(),
                            metadata: {
                                ...savedMapping.metadata,
                                disbursementDetails: {
                                    amount: disbursementAmount,
                                    date: new Date().toISOString()
                                }
                            }
                        });

                        // Log updated mapping details
                        logger.info('✅ Loan mapping updated with disbursement details:', {
                            applicationNumber: updatedMapping.essApplicationNumber,
                            loanNumber: updatedMapping.essLoanNumberAlias,
                            mifosLoanId: updatedMapping.mifosLoanId,
                            mifosClientId: updatedMapping.mifosClientId,
                            status: updatedMapping.status,
                            requestedAmount: updatedMapping.requestedAmount
                        });

                        // Prepare LOAN_DISBURSEMENT_NOTIFICATION callback
                        const callbackData = {
                            Data: {
                                Header: {
                                    "Sender": process.env.FSP_NAME || "ZE DONE",
                                    "Receiver": "ESS_UTUMISHI",
                                    "FSPCode": header.FSPCode,
                                    "MsgId": getMessageId("LOAN_DISBURSEMENT_NOTIFICATION"),
                                    "MessageType": "LOAN_DISBURSEMENT_NOTIFICATION"
                                },
                                MessageDetails: {
                                    "ApplicationNumber": messageDetails.ApplicationNumber,
                                    "Reason": "Loan successfully disbursed",
                                    "FSPReferenceNumber": messageDetails.FSPReferenceNumber,
                                    "LoanNumber": messageDetails.LoanNumber,
                                    "TotalAmountToPay": updatedMapping.disbursedAmount || updatedMapping.requestedAmount,
                                    "DisbursementDate": formatDateTimeForUTUMISHI(new Date())
                                }
                            }
                        };

                        // Log disbursement notification details
                        logger.info('📤 Preparing to send disbursement notification (will send in 60 seconds):', {
                            applicationNumber: messageDetails.ApplicationNumber,
                            loanNumber: messageDetails.LoanNumber,
                            amount: updatedMapping.requestedAmount
                        });

                        // Send callback notification after 60 seconds delay
                        setTimeout(async () => {
                            try {
                                logger.info('📤 Sending disbursement notification after 60s delay:', {
                                    applicationNumber: messageDetails.ApplicationNumber,
                                    loanNumber: messageDetails.LoanNumber
                                });
                                await sendCallback(callbackData);
                                logger.info('✅ Disbursement notification sent successfully');
                            } catch (callbackError) {
                                logger.error('❌ Error sending disbursement notification after delay:', callbackError);
                            }
                        }, 60000); // 60 seconds delay
                    } catch (error) {
                        logger.error('Error in disbursement processing:', error);
                        throw error;
                    }
                }
            } catch (error) {
                logger.error('Error in async processing:', error);
                logger.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    loanNumber: messageDetails.LoanNumber,
                    applicationNumber: messageDetails.ApplicationNumber
                });
            }
        });

        // Create audit log for initial receipt
        await AuditLog.create({
            userId: 'system',
            action: 'LOAN_FINAL_APPROVAL_RECEIVED',
            description: `Final approval received for loan ${messageDetails.LoanNumber}`,
            eventType: 'LOAN_FINAL_APPROVAL_RECEIVED',
            data: {
                loanNumber: messageDetails.LoanNumber,
                applicationNumber: messageDetails.ApplicationNumber,
                approval: messageDetails.Approval
            }
        }).catch(err => {
            logger.error('Error saving audit log:', err.message);
        });

    } catch (error) {
        logger.error('Error processing loan final approval:', error);
        if (!responseSent) {
            return sendErrorResponse(res, '8012', error.message, 'xml', parsedData);
            responseSent = true;
        }
    }
};

const handleTakeoverDisbursementNotification = async (parsedData, res) => {
    try {
        logger.info('Processing TAKEOVER_DISBURSEMENT_NOTIFICATION...');
        
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;
        
        // Extract request data
        const applicationNumber = messageDetails.ApplicationNumber;
        const loanNumber = messageDetails.LoanNumber;
        const fspReferenceNumber = messageDetails.FSPReferenceNumber;
        
        logger.info('Takeover disbursement notification details:', {
            applicationNumber,
            loanNumber,
            fspReferenceNumber
        });

        // Validate required fields
        if (!applicationNumber) {
            logger.error('Missing required field: ApplicationNumber');
            return sendErrorResponse(res, '8003', 'Missing required field: ApplicationNumber', 'xml', parsedData);
        }

        // Find loan mapping
        let loanMapping;
        try {
            loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber);
        } catch (error) {
            logger.error('Error finding loan mapping:', error);
            return sendErrorResponse(res, '8010', 'Error finding loan mapping: ' + error.message, 'xml', parsedData);
        }

        if (!loanMapping) {
            logger.error('Loan mapping not found for application:', applicationNumber);
            return sendErrorResponse(res, '8010', 'Loan mapping not found', 'xml', parsedData);
        }

        // Update loan status to indicate disbursement
        try {
            await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, 'DISBURSED');
            logger.info('Updated loan status to DISBURSED');
        } catch (updateError) {
            logger.error('Error updating loan status:', updateError);
            // Continue anyway, don't fail the request
        }

        // Send success response
        const responseData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": header.Sender,
                    "FSPCode": process.env.FSP_CODE || "FL8090", 
                    "MsgId": getMessageId("RESPONSE"),
                    "MessageType": "RESPONSE"
                },
                MessageDetails: {
                    "Status": "SUCCESS",
                    "StatusCode": "8000",
                    "StatusDesc": "Takeover disbursement notification received and processed"
                }
            }
        };
        
        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        res.status(200).send(signedResponse);
        
    } catch (error) {
        logger.error('Error processing takeover disbursement notification:', error);
        return sendErrorResponse(res, '8011', 'Error processing request: ' + error.message, 'xml', parsedData);
    }
};

// Export handlers
exports.handleMifosWebhook = handleMifosWebhook;
exports.handleLoanChargesRequest = handleLoanChargesRequest;
exports.handleLoanOfferRequest = handleLoanOfferRequest;
exports.handleLoanRestructureRequest = handleLoanRestructureRequest;
exports.handleLoanRestructureBalanceRequest = handleLoanRestructureBalanceRequest;
exports.handleLoanRestructureAffordabilityRequest = handleLoanRestructureAffordabilityRequest;
exports.handleTopUpPayOffBalanceRequest = handleTopUpPayOffBalanceRequest;
exports.handleTakeoverPayOffBalanceRequest = handleTakeoverPayOffBalanceRequest;
exports.handleTopUpOfferRequest = handleTopUpOfferRequest;
exports.handleLoanTakeoverOfferRequest = handleLoanTakeoverOfferRequest;
exports.handleTakeoverPaymentNotification = handleTakeoverPaymentNotification;
exports.handlePaymentAcknowledgmentNotification = handlePaymentAcknowledgmentNotification;