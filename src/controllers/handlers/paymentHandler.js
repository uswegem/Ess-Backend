const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { sendCallback } = require('../../utils/callbackUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const { formatDateForMifos } = require('../../utils/dateUtils');
const LoanMappingService = require('../../services/loanMappingService');
const api = require('../../services/cbs.api').maker;
const { API_ENDPOINTS } = require('../../services/cbs.endpoints');

/**
 * Handle TAKEOVER_PAYMENT_NOTIFICATION
 * Processes payment notifications for loan takeovers
 */
const handleTakeoverPaymentNotification = async (parsedData, res) => {
    try {
        logger.info('Processing TAKEOVER_PAYMENT_NOTIFICATION...');
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;
        
        // Extract request data
        const applicationNumber = messageDetails.ApplicationNumber;
        const loanNumber = messageDetails.LoanNumber;
        const checkNumber = messageDetails.CheckNumber;
        const currentFSPCode = messageDetails.CurrentFSPCode;
        const paymentAmount = parseFloat(messageDetails.PaymentAmount || 0);
        const paymentDate = messageDetails.PaymentDate;
        
        logger.info('Takeover payment notification details:', {
            applicationNumber,
            loanNumber,
            checkNumber,
            currentFSPCode,
            paymentAmount,
            paymentDate
        });

        // Validate required fields
        if (!loanNumber && !applicationNumber) {
            logger.error('Missing required fields: LoanNumber or ApplicationNumber');
            return sendErrorResponse(res, '8003', 'Missing required field: LoanNumber or ApplicationNumber', 'xml', parsedData);
        }

        // Send acknowledgment response first
        const responseData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": header.Sender || "ESS_UTUMISHI",
                    "FSPCode": process.env.FSP_CODE || "FL8090",
                    "MsgId": getMessageId("RESPONSE"),
                    "MessageType": "RESPONSE"
                },
                MessageDetails: {
                    "Status": "SUCCESS",
                    "StatusCode": "8000",
                    "StatusDesc": "Takeover payment notification received and being processed"
                }
            }
        };
        
        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        res.status(200).send(signedResponse);

        // Process takeover payment asynchronously
        processTakeoverPayment(parsedData);
        
    } catch (error) {
        logger.error('Error processing takeover payment notification:', error);
        return sendErrorResponse(res, '8011', 'Error processing request: ' + error.message, 'xml', parsedData);
    }
};

/**
 * Process takeover payment asynchronously
 */
const processTakeoverPayment = async (parsedData) => {
    try {
        const messageDetails = parsedData.Document.Data.MessageDetails;
        const applicationNumber = messageDetails.ApplicationNumber;
        const loanNumber = messageDetails.LoanNumber;
        const paymentAmount = parseFloat(messageDetails.PaymentAmount || 0);
        const paymentDate = messageDetails.PaymentDate;
        const checkNumber = messageDetails.CheckNumber;

        logger.info('🔄 Starting takeover payment processing for loan:', loanNumber || applicationNumber);

        // Find loan mapping using LoanNumber or ApplicationNumber
        let loanMapping;
        try {
            if (loanNumber) {
                // First try to find by ESS loan number alias
                loanMapping = await LoanMappingService.getByEssLoanNumberAlias(loanNumber);
                
                if (!loanMapping && applicationNumber) {
                    // Fallback to application number
                    loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber);
                }
            } else if (applicationNumber) {
                loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber);
            }
        } catch (error) {
            logger.error('Error finding loan mapping for takeover payment:', error);
            return;
        }

        if (!loanMapping) {
            logger.error('❌ Loan mapping not found for takeover payment, loan:', loanNumber, 'application:', applicationNumber);
            return;
        }

        const mifosLoanId = loanMapping.mifosLoanId;
        const fspReferenceNumber = loanMapping.fspReferenceNumber;
        logger.info('✅ Found loan mapping - Mifos Loan ID:', mifosLoanId, 'FSP Ref:', fspReferenceNumber);

        // Query MIFOS to get loan details
        let loanDetails;
        try {
            const loanResponse = await api.get(`/v1/loans/${mifosLoanId}?associations=repaymentSchedule,transactions`);
            loanDetails = loanResponse.data;
            logger.info('📊 Fetched loan details from MIFOS:', {
                status: loanDetails.status?.value,
                outstanding: loanDetails.summary?.totalOutstanding
            });
        } catch (error) {
            logger.error('❌ Error fetching loan details from MIFOS:', error);
            return;
        }

        // Calculate outstanding amount
        const outstandingBalance = parseFloat(loanDetails.summary?.totalOutstanding || 0);
        logger.info('💰 Loan outstanding balance:', outstandingBalance.toFixed(2));

        // Make full repayment to close the loan
        if (outstandingBalance > 0) {
            try {
                const repaymentAmount = outstandingBalance;
                const repaymentPayload = {
                    transactionDate: paymentDate || formatDateForMifos(new Date()),
                    transactionAmount: repaymentAmount,
                    paymentTypeId: 1, // Cash payment type
                    note: `Takeover payment from ${messageDetails.CurrentFSPCode || 'External FSP'} - Check: ${checkNumber || 'N/A'} - Amount: ${paymentAmount}`
                };

                logger.info('💳 Making repayment to close loan:', repaymentPayload);

                const repaymentResponse = await api.post(
                    `${API_ENDPOINTS.LOAN}${mifosLoanId}/transactions?command=repayment`,
                    repaymentPayload
                );

                if (!repaymentResponse.data) {
                    throw new Error('Failed to make repayment: ' + JSON.stringify(repaymentResponse));
                }

                logger.info('✅ Successfully made repayment to close loan:', {
                    loanId: mifosLoanId,
                    amount: repaymentAmount.toFixed(2),
                    transactionId: repaymentResponse.data.resourceId
                });

                // Update loan mapping status
                await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, 'CLOSED');
                logger.info('✅ Updated loan status to CLOSED');

                // Send PAYMENT_ACKNOWLEDGMENT_NOTIFICATION to Utumishi
                await sendPaymentAcknowledgmentNotification(
                    applicationNumber,
                    loanNumber || loanMapping.essLoanNumberAlias,
                    fspReferenceNumber
                );

            } catch (repaymentError) {
                logger.error('❌ Error making repayment:', repaymentError);
                // Update status to indicate payment processing failed
                try {
                    await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, 'PAYMENT_FAILED');
                } catch (statusError) {
                    logger.error('Error updating status to PAYMENT_FAILED:', statusError);
                }
            }
        } else {
            logger.info('⚠️ Loan already has zero outstanding balance, marking as closed');
            await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, 'CLOSED');
            
            // Still send payment acknowledgment
            await sendPaymentAcknowledgmentNotification(
                applicationNumber,
                loanNumber || loanMapping.essLoanNumberAlias,
                fspReferenceNumber
            );
        }

    } catch (error) {
        logger.error('❌ Error in processTakeoverPayment:', error);
    }
};

/**
 * Send PAYMENT_ACKNOWLEDGMENT_NOTIFICATION to Utumishi
 */
const sendPaymentAcknowledgmentNotification = async (applicationNumber, loanNumber, fspReferenceNumber) => {
    try {
        logger.info('📤 Sending PAYMENT_ACKNOWLEDGMENT_NOTIFICATION to Utumishi...');
        
        const callbackData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": "ESS_UTUMISHI",
                    "FSPCode": process.env.FSP_CODE || "FL8090",
                    "MsgId": getMessageId("PAYMENT_ACKNOWLEDGMENT_NOTIFICATION"),
                    "MessageType": "PAYMENT_ACKNOWLEDGMENT_NOTIFICATION"
                },
                MessageDetails: {
                    "ApplicationNumber": applicationNumber,
                    "LoanNumber": loanNumber,
                    "FSPReferenceNumber": fspReferenceNumber,
                    "Status": "SUCCESS",
                    "PaymentDate": formatDateForMifos(new Date()),
                    "Remarks": "Loan successfully closed via takeover payment"
                }
            }
        };

        await sendCallback(callbackData);
        logger.info('✅ Payment acknowledgment notification sent successfully');
        
    } catch (error) {
        logger.error('❌ Error sending payment acknowledgment notification:', error);
    }
};

/**
 * Handle PAYMENT_ACKNOWLEDGMENT_NOTIFICATION
 * Processes payment acknowledgment notifications
 */
const handlePaymentAcknowledgmentNotification = async (parsedData, res) => {
    try {
        logger.info('Processing PAYMENT_ACKNOWLEDGMENT_NOTIFICATION...');
        
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;
        
        // Extract request data
        const applicationNumber = messageDetails.ApplicationNumber;
        const loanNumber = messageDetails.LoanNumber;
        const fspReferenceNumber = messageDetails.FSPReferenceNumber;
        const totalPayoffAmount = messageDetails.TotalPayoffAmount;
        const paymentReferenceNumber = messageDetails.PaymentReferenceNumber;
        const paymentDate = messageDetails.PaymentDate;
        
        logger.info('Payment acknowledgment details:', {
            applicationNumber,
            loanNumber,
            fspReferenceNumber,
            totalPayoffAmount,
            paymentReferenceNumber,
            paymentDate
        });

        // Validate required fields
        if (!applicationNumber) {
            logger.error('Missing required field: ApplicationNumber');
            return sendErrorResponse(res, '8003', 'Missing required field: ApplicationNumber', 'xml', parsedData);
        }

        // Send acknowledgment response first
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
                    "StatusDesc": "Payment acknowledgment received and being processed"
                }
            }
        };
        
        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        res.status(200).send(signedResponse);

        // Now process the payment acknowledgment asynchronously
        processPaymentAcknowledgment(parsedData);
        
    } catch (error) {
        logger.error('Error processing payment acknowledgment notification:', error);
        return sendErrorResponse(res, '8011', 'Error processing request: ' + error.message, 'xml', parsedData);
    }
};

/**
 * Process payment acknowledgment asynchronously
 */
const processPaymentAcknowledgment = async (parsedData) => {
    try {
        const messageDetails = parsedData.Document.Data.MessageDetails;
        const applicationNumber = messageDetails.ApplicationNumber;
        const totalPayoffAmount = messageDetails.TotalPayoffAmount;
        const paymentDate = messageDetails.PaymentDate;

        // Find loan mapping
        let loanMapping;
        try {
            loanMapping = await LoanMappingService.getByEssApplicationNumber(applicationNumber);
        } catch (error) {
            logger.error('Error finding loan mapping for payment acknowledgment:', error);
            return;
        }

        if (!loanMapping) {
            logger.error('Loan mapping not found for payment acknowledgment, application:', applicationNumber);
            return;
        }

        const mifosLoanId = loanMapping.mifosLoanId;
        logger.info('Found loan mapping, MIFOS loan ID:', mifosLoanId);

        // Query MIFOS to get loan details
        let loanDetails;
        try {
            const loanResponse = await api.get(`/v1/loans/${mifosLoanId}?associations=repaymentSchedule,transactions`);
            if (!loanResponse.status) {
                throw new Error('Failed to fetch loan details from MIFOS');
            }
            loanDetails = loanResponse.response;
            logger.info('Fetched loan details from MIFOS');
        } catch (error) {
            logger.error('Error fetching loan details from MIFOS:', error);
            return;
        }

        // Calculate outstanding amount
        const outstandingBalance = loanDetails.summary?.totalOutstanding || 0;
        logger.info('Loan outstanding balance:', outstandingBalance);

        // Make full repayment to close the loan
        if (outstandingBalance > 0) {
            try {
                const repaymentAmount = outstandingBalance;
                const repaymentResponse = await api.post(`${API_ENDPOINTS.LOAN}${mifosLoanId}/transactions?command=repayment`, {
                    transactionDate: paymentDate || formatDateForMifos(new Date()),
                    transactionAmount: repaymentAmount,
                    paymentTypeId: 1, // Assuming cash payment type
                    note: `Full repayment for loan closure - Payment ref: ${messageDetails.PaymentReferenceNumber || 'N/A'}`
                });

                if (!repaymentResponse.status) {
                    throw new Error('Failed to make repayment: ' + JSON.stringify(repaymentResponse.response));
                }

                logger.info('✅ Successfully made full repayment to close loan:', {
                    loanId: mifosLoanId,
                    amount: repaymentAmount
                });

                // Update loan mapping status
                await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, 'CLOSED');
                logger.info('Updated loan status to CLOSED');

            } catch (repaymentError) {
                logger.error('Error making repayment:', repaymentError);
                // Update status to indicate payment processing failed
                await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, 'PAYMENT_FAILED');
            }
        } else {
            logger.info('Loan already has zero outstanding balance');
            await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, 'CLOSED');
        }

    } catch (error) {
        logger.error('Error in processPaymentAcknowledgment:', error);
    }
};

module.exports = {
    handleTakeoverPaymentNotification,
    handlePaymentAcknowledgmentNotification,
    processTakeoverPayment,
    processPaymentAcknowledgment,
    sendPaymentAcknowledgmentNotification
};
