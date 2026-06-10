const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { sendCallback } = require('../../utils/callbackUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const LOAN_CONSTANTS = require('../../utils/loanConstants');
const { generateLoanNumber, generateFSPReferenceNumber } = require('../../utils/loanUtils');
const LoanMappingService = require('../../services/loanMappingService');

/**
 * Handle TOP_UP_OFFER_REQUEST
 * Processes top-up loan offers and sends approval callback
 */
const handleTopUpOfferRequest = async (parsedData, res) => {
    try {
        logger.info('Processing TOP_UP_OFFER_REQUEST...');
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;

        // Store client and loan data similar to LOAN_OFFER_REQUEST
        try {
            const clientData = {
                firstName: messageDetails.FirstName,
                middleName: messageDetails.MiddleName,
                lastName: messageDetails.LastName,
                sex: messageDetails.Sex,
                nin: messageDetails.NIN,
                mobileNo: messageDetails.MobileNo,
                dateOfBirth: messageDetails.DateOfBirth,
                maritalStatus: messageDetails.MaritalStatus,
                bankAccountNumber: messageDetails.BankAccountNumber,
                swiftCode: messageDetails.SwiftCode
            };

            const loanData = {
                productCode: messageDetails.ProductCode || '17',
                requestedAmount: messageDetails.RequestedAmount,
                tenure: messageDetails.Tenure,
                existingLoanNumber: messageDetails.ExistingLoanNumber
            };

            const employmentData = {
                employmentDate: messageDetails.EmploymentDate,
                retirementDate: messageDetails.RetirementDate,
                termsOfEmployment: messageDetails.TermsOfEmployment,
                voteCode: messageDetails.VoteCode,
                basicSalary: messageDetails.BasicSalary,
                netSalary: messageDetails.NetSalary
            };

            await LoanMappingService.createOrUpdateWithClientData(
                messageDetails.ApplicationNumber,
                messageDetails.CheckNumber,
                clientData,
                loanData,
                employmentData,
                'TOP_UP_OFFER_REQUEST' // Set original message type
            );
            logger.info('✅ Top-up client data stored successfully');
        } catch (storageError) {
            logger.error('❌ Error storing top-up client data:', storageError);
            // Continue with response even if storage fails
        }

        // Send immediate ACK response
        const ackResponseData = {
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

        // Sign and send the immediate ACK response
        const ackSignedResponse = digitalSignature.createSignedXML(ackResponseData.Data);
        res.status(200).send(ackSignedResponse);
        logger.info('✅ Sent immediate ACK response for TOP_UP_OFFER_REQUEST');

        // Schedule LOAN_INITIAL_APPROVAL_NOTIFICATION to be sent via callback after 20 seconds
        setTimeout(async () => {
            try {
                logger.info('⏰ Sending delayed LOAN_INITIAL_APPROVAL_NOTIFICATION callback for TOP_UP_OFFER_REQUEST...');
                
                // Generate loan details for top-up (use similar logic to LOAN_OFFER_REQUEST)
                const loanAmount = parseFloat(messageDetails.RequestedAmount) || LOAN_CONSTANTS.MIN_LOAN_AMOUNT;
                const interestRate = 24.0; // 24% per annum (same as regular loans)
                const tenure = parseInt(messageDetails.Tenure) || LOAN_CONSTANTS.MAX_TENURE;
                
                // Calculate total amount to pay
                const totalInterestRateAmount = (loanAmount * interestRate * tenure) / (12 * 100);
                const totalAmountToPay = loanAmount + totalInterestRateAmount;
                const otherCharges = LOAN_CONSTANTS?.OTHER_CHARGES || 50000;
                const loanNumber = generateLoanNumber();
                const fspReferenceNumber = generateFSPReferenceNumber();
                
                // Create/update loan mapping with approval details
                try {
                    logger.info('🔄 Creating initial loan mapping...', {
                        applicationNumber: messageDetails.ApplicationNumber,
                        checkNumber: messageDetails.CheckNumber,
                        fspReferenceNumber: fspReferenceNumber,
                        loanNumber: loanNumber,
                        requestedAmount: loanAmount
                    });

                    const mapping = await LoanMappingService.createInitialMapping(
                        messageDetails.ApplicationNumber,
                        messageDetails.CheckNumber,
                        fspReferenceNumber,
                        {
                            essLoanNumberAlias: loanNumber,
                            productCode: messageDetails.ProductCode || "17",
                            requestedAmount: loanAmount,
                            totalAmountToPay: totalAmountToPay,
                            interestRate: interestRate,
                            tenure: tenure,
                            otherCharges: otherCharges,
                            status: 'INITIAL_APPROVAL_SENT'
                        }
                    );
                    logger.info('✅ Created loan mapping for top-up offer', { mappingId: mapping._id });
                } catch (mappingError) {
                    logger.error('❌ Critical Error: Failed to create loan mapping for top-up offer', {
                        applicationNumber: messageDetails.ApplicationNumber,
                        error: mappingError.message,
                        stack: mappingError.stack,
                        errorType: mappingError.name
                    });
                    
                    // Log the error but don't fail the callback - UTUMISHI already received approval
                    // This ensures system resilience even if database operations fail
                    logger.warn('⚠️ Continuing with callback despite mapping error - manual intervention may be required');
                }
                
                const approvalResponseData = {
                    Data: {
                        Header: {
                            "Sender": process.env.FSP_NAME || "ZE DONE",
                            "Receiver": "ESS_UTUMISHI",
                            "FSPCode": header.FSPCode,
                            "MsgId": getMessageId("LOAN_INITIAL_APPROVAL_NOTIFICATION"),
                            "MessageType": "LOAN_INITIAL_APPROVAL_NOTIFICATION"
                        },
                        MessageDetails: {
                            "ApplicationNumber": messageDetails.ApplicationNumber,
                            "Reason": "Top-Up Loan Request Approved",
                            "FSPReferenceNumber": fspReferenceNumber,
                            "LoanNumber": loanNumber,
                            "TotalAmountToPay": totalAmountToPay.toFixed(2),
                            "OtherCharges": otherCharges.toFixed(2),
                            "Approval": "APPROVED"
                        }
                    }
                };

                logger.info('📤 Sending TOP_UP_OFFER_REQUEST callback with data:', {
                    ApplicationNumber: messageDetails.ApplicationNumber,
                    LoanNumber: loanNumber,
                    TotalAmountToPay: totalAmountToPay.toFixed(2),
                    OtherCharges: otherCharges.toFixed(2)
                });

                await sendCallback(approvalResponseData);
                logger.info('✅ TOP_UP_OFFER_REQUEST callback sent successfully');
                
                // Track callback in loan mapping
                try {
                    const mapping = await LoanMappingService.getByEssApplicationNumber(messageDetails.ApplicationNumber);
                    if (mapping) {
                        await LoanMappingService.updateStatus(mapping.essApplicationNumber, mapping.status, {
                            metadata: {
                                ...(mapping.metadata || {}),
                                callbacksSent: [
                                    ...((mapping.metadata?.callbacksSent) || []),
                                    {
                                        type: 'LOAN_INITIAL_APPROVAL_NOTIFICATION',
                                        sentAt: new Date(),
                                        status: 'success',
                                        loanNumber: loanNumber,
                                        fspReferenceNumber: fspReferenceNumber
                                    }
                                ]
                            }
                        });
                    }
                } catch (trackError) {
                    logger.warn('⚠️ Could not track callback in mapping:', trackError.message);
                }
            } catch (callbackError) {
                logger.error('❌ Error sending TOP_UP_OFFER_REQUEST callback:', callbackError);
                
                // Track failed callback
                try {
                    const mapping = await LoanMappingService.getByEssApplicationNumber(messageDetails.ApplicationNumber);
                    if (mapping) {
                        await LoanMappingService.updateStatus(mapping.essApplicationNumber, mapping.status, {
                            metadata: {
                                ...(mapping.metadata || {}),
                                callbacksSent: [
                                    ...((mapping.metadata?.callbacksSent) || []),
                                    {
                                        type: 'LOAN_INITIAL_APPROVAL_NOTIFICATION',
                                        sentAt: new Date(),
                                        status: 'failed',
                                        error: callbackError.message
                                    }
                                ]
                            }
                        });
                    }
                } catch (trackError) {
                    logger.warn('⚠️ Could not track failed callback:', trackError.message);
                }
            }
        }, 20000); // 20 seconds delay

    } catch (error) {
        logger.error('❌ Error processing TOP_UP_OFFER_REQUEST:', error);
        if (!res.headersSent) {
            return sendErrorResponse(res, '8002', `Processing error: ${error.message}`, 'xml', parsedData);
        }
    }
};

module.exports = handleTopUpOfferRequest;
