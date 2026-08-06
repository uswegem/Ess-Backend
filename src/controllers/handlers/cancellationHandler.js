const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const LoanMappingService = require('../../services/loanMappingService');
const api = require('../../services/cbs.api').maker;
const { cancelLoan } = require('../../utils/loanStatusHelpers');

/**
 * Handle LOAN_CANCELLATION_NOTIFICATION
 * Processes loan cancellation requests from employees
 * Cancels loans that have not yet been disbursed
 */
const handleLoanCancellation = async (parsedData, res) => {
    try {
        logger.info('Processing LOAN_CANCELLATION_NOTIFICATION...');
        
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;
        
        // Extract request data
        const applicationNumber = messageDetails.ApplicationNumber;
        const reason = messageDetails.Reason;
        const fspReferenceNumber = messageDetails.FSPReferenceNumber;
        const loanNumber = messageDetails.LoanNumber;
        
        logger.info('Loan cancellation request details:', {
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
            logger.info('Active loan mapping not found, treating as already cancelled or never created:', { applicationNumber });
            // If no active mapping exists, treat as successful cancellation
            const responseData = {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": header.Sender,
                    "FSPCode": process.env.FSP_CODE || "FL8090", 
                    "MsgId": getMessageId("LOAN_CANCELLATION_RESPONSE"),
                    "MessageType": "RESPONSE"
                },
                MessageDetails: {
                    "ResponseCode": "0000",
                    "Description": `Loan cancellation acknowledged for application: ${applicationNumber}. No active loan found.`
                }
            };

            const responseXML = digitalSignature.createSignedXML(responseData);
            res.set('Content-Type', 'application/xml');
            return res.send(responseXML);
        }

        logger.info('Found loan mapping:', {
            id: loanMapping._id,
            status: loanMapping.status,
            mifosLoanId: loanMapping.mifosLoanId,
            essApplicationNumber: loanMapping.essApplicationNumber
        });

        // Check if loan can be cancelled (must not be disbursed)
        const cancellableStatuses = ['INITIAL_OFFER', 'APPROVED', 'FINAL_APPROVAL_RECEIVED', 'CLIENT_CREATED', 'LOAN_CREATED'];
        
        if (!cancellableStatuses.includes(loanMapping.status)) {
            logger.error('Loan cannot be cancelled in current status:', { 
                status: loanMapping.status,
                applicationNumber 
            });
            return sendErrorResponse(
                res, 
                '8006', 
                `Loan cannot be cancelled in status: ${loanMapping.status}. Only loans that are not yet disbursed can be cancelled.`, 
                'xml', 
                parsedData
            );
        }

        // If loan was created in MIFOS, reject it there
        if (loanMapping.mifosLoanId && loanMapping.status === 'LOAN_CREATED') {
            try {
                logger.info('Attempting to reject loan in MIFOS:', { mifosLoanId: loanMapping.mifosLoanId });
                
                const rejectPayload = {
                    rejectedOnDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
                    locale: "en",
                    dateFormat: "yyyy-MM-dd",
                    note: reason || 'Loan cancelled by employee'
                };

                const rejectResponse = await api.post(
                    `/v1/loans/${loanMapping.mifosLoanId}?command=reject`, 
                    rejectPayload
                );

                if (rejectResponse.status) {
                    logger.info('Loan successfully rejected in MIFOS:', {
                        mifosLoanId: loanMapping.mifosLoanId,
                        response: rejectResponse.response
                    });
                } else {
                    logger.warn('Failed to reject loan in MIFOS (continuing with local cancellation):', {
                        mifosLoanId: loanMapping.mifosLoanId,
                        error: rejectResponse
                    });
                }
            } catch (mifosError) {
                // Log error but continue with local cancellation
                logger.warn('Error rejecting loan in MIFOS (continuing with local cancellation):', {
                    mifosLoanId: loanMapping.mifosLoanId,
                    error: mifosError.message
                });
            }
        }

        // Update loan mapping status to CANCELLED using helper function
        await cancelLoan(loanMapping, 'EMPLOYEE', reason || 'Loan cancelled by employee');
        
        // Update FSP reference if provided
        if (fspReferenceNumber && fspReferenceNumber !== loanMapping.fspReferenceNumber) {
            loanMapping.fspReferenceNumber = fspReferenceNumber;
            await loanMapping.save();
        }

        logger.info('Loan mapping updated to CANCELLED:', {
            applicationNumber
        });

        // Send success acknowledgment
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
                    "Description": "Loan cancellation processed successfully"
                }
            }
        };

        logger.info('Sending cancellation acknowledgment:', responseData.Data.MessageDetails);
        
        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        res.status(200).send(signedResponse);

    } catch (error) {
        logger.error('Error processing LOAN_CANCELLATION_NOTIFICATION:', error);
        return sendErrorResponse(res, '8002', `Processing error: ${error.message}`, 'xml', parsedData);
    }
};

module.exports = handleLoanCancellation;
