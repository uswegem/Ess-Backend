const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { sendCallback } = require('../../utils/callbackUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const LOAN_CONSTANTS = require('../../utils/loanConstants');
const loanUtils = require('../../utils/loanUtils');
const { generateLoanNumber, generateFSPReferenceNumber } = loanUtils;
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

                // Tenant-scoped product lookup - source of the calculation rates. No
                // LOAN_CONSTANTS fallback. The ACK for this message was already sent
                // synchronously before this setTimeout ran, so a missing/inactive product
                // here is recorded as LoanMapping.status='FAILED' with an explicit reason -
                // never a silently-substituted default, and never a callback promising an
                // offer that was never actually calculated from a real product.
                let productRates;
                try {
                    productRates = await loanUtils.resolveProductForCalculation(messageDetails.ProductCode);
                } catch (productError) {
                    logger.error(`❌ Product resolution failed for TOP_UP_OFFER_REQUEST: ${productError.message}`);
                    try {
                        await LoanMappingService.createInitialMapping(
                            messageDetails.ApplicationNumber,
                            messageDetails.CheckNumber,
                            generateFSPReferenceNumber(),
                            {
                                productCode: messageDetails.ProductCode || '17',
                                requestedAmount: parseFloat(messageDetails.RequestedAmount) || 0,
                                tenure: parseInt(messageDetails.Tenure) || 0,
                                status: 'FAILED',
                                metadata: {
                                    failureReason: productError.message,
                                    failedAt: new Date().toISOString()
                                }
                            }
                        );
                    } catch (mappingError) {
                        logger.error('❌ Error recording FAILED mapping for TOP_UP_OFFER_REQUEST product resolution failure:', mappingError);
                    }
                    return; // Do not send an approval callback for an offer that was never calculated
                }
                const { interestRate, otherCharges: otherChargesAmount, maxTenure } = productRates;

                // Generate loan details for top-up (use similar logic to LOAN_OFFER_REQUEST)
                const loanAmount = parseFloat(messageDetails.RequestedAmount) || LOAN_CONSTANTS.MIN_LOAN_AMOUNT;
                const tenure = parseInt(messageDetails.Tenure) || maxTenure;

                // Calculate total amount to pay
                const totalInterestRateAmount = (loanAmount * interestRate * tenure) / (12 * 100);
                const totalAmountToPay = loanAmount + totalInterestRateAmount;
                const otherCharges = otherChargesAmount;
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
                            status: 'INITIAL_APPROVAL_SENT',
                            quotedMifosProductId: productRates.product.mifosProductId,
                            quotedInterestRate: interestRate,
                            quotedProcessingFee: productRates.product.processingFee,
                            quotedInsurance: productRates.product.insurance,
                            quotedOtherCharges: productRates.product.otherCharges,
                            quotedAt: new Date()
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
