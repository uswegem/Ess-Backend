const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { sendCallback } = require('../../utils/callbackUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const LoanCalculations = require('../../utils/loanCalculations');
const { generateLoanNumber, generateFSPReferenceNumber } = require('../../utils/loanUtils');
const LoanMappingService = require('../../services/loanMappingService');

/**
 * Handle LOAN_TAKEOVER_OFFER_REQUEST
 * Processes loan takeover offers and sends approval callback
 */
const handleLoanTakeoverOfferRequest = async (parsedData, res) => {
    try {
        logger.info('Processing LOAN_TAKEOVER_OFFER_REQUEST...');
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;

        // Step 1: Send immediate ACK response FIRST (before any processing)
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
                    "Status": "SUCCESS",
                    "StatusCode": "8000",
                    "StatusDesc": "Request received and being processed"
                }
            }
        };
        
        const signedResponse = digitalSignature.createSignedXML(ackResponseData.Data);
        res.status(200).send(signedResponse);
        logger.info('✅ Sent immediate ACK response for LOAN_TAKEOVER_OFFER_REQUEST');

        // Step 2: Store client and loan data (after ACK is sent)
        const clientData = {
            firstName: messageDetails.FirstName,
            middleName: messageDetails.MiddleName,
            lastName: messageDetails.LastName,
            sex: messageDetails.Sex,
            nin: messageDetails.NIN,
            mobileNo: messageDetails.MobileNumber,
            dateOfBirth: messageDetails.DateOfBirth,
            maritalStatus: messageDetails.MaritalStatus,
            bankAccountNumber: messageDetails.BankAccountNumber,
            swiftCode: messageDetails.SwiftCode,
            emailAddress: messageDetails.EmailAddress
        };

        const loanData = {
            productCode: messageDetails.ProductCode || '17',
            requestedAmount: messageDetails.RequestedAmount,
            tenure: messageDetails.Tenure,
            existingLoanNumber: messageDetails.ExistingLoanNumber,
            loanPurpose: messageDetails.LoanPurpose,
            takeOverAmount: parseFloat(messageDetails.TakeOverAmount || 0),
            fsp1LoanNumber: messageDetails.FSP1LoanNumber,
            fsp1BankAccount: messageDetails.FSP1BankAccount,
            fsp1BankAccountName: messageDetails.FSP1BankAccountName,
            fsp1SwiftCode: messageDetails.FSP1SWIFTCode
        };

        const employmentData = {
            employmentDate: messageDetails.EmploymentDate,
            retirementDate: messageDetails.RetirementDate,
            termsOfEmployment: messageDetails.TermsOfEmployment,
            voteCode: messageDetails.VoteCode,
            voteName: messageDetails.VoteName,
            designationCode: messageDetails.DesignationCode,
            designationName: messageDetails.DesignationName,
            basicSalary: messageDetails.BasicSalary,
            netSalary: messageDetails.NetSalary,
            oneThirdAmount: messageDetails.OneThirdAmount,
            totalEmployeeDeduction: messageDetails.TotalEmployeeDeduction
        };

        try {
            await LoanMappingService.createOrUpdateWithClientData(
                messageDetails.ApplicationNumber,
                messageDetails.CheckNumber,
                clientData,
                loanData,
                employmentData,
                'LOAN_TAKEOVER_OFFER_REQUEST' // Set original message type
            );
            logger.info('✅ Takeover client data stored successfully');
        } catch (storageError) {
            logger.error('❌ Error storing takeover client data:', storageError);
            // Continue with callback even if storage fails
        }

        // Step 3: Wait 10 seconds then send LOAN_INITIAL_APPROVAL_NOTIFICATION callback
        setTimeout(async () => {
            try {
                logger.info('⏰ Sending delayed LOAN_INITIAL_APPROVAL_NOTIFICATION for takeover...');

                // Generate loan details for takeover
                // RequestedAmount is optional in XML, fallback to TakeOverAmount (required field)
                let requestedAmount = parseFloat(messageDetails.RequestedAmount) || 0;
                const takeOverAmount = parseFloat(messageDetails.TakeOverAmount) || 0;
                
                // Use TakeOverAmount if RequestedAmount is not provided (as per ESS API spec 2.5.5)
                if (!requestedAmount || requestedAmount <= 0) {
                    if (takeOverAmount > 0) {
                        requestedAmount = takeOverAmount;
                        logger.info('ℹ️ Using TakeOverAmount as requestedAmount for takeover', {
                            essApplicationNumber: messageDetails.ApplicationNumber,
                            takeOverAmount,
                            reason: 'RequestedAmount is optional field'
                        });
                    } else {
                        logger.error('❌ Both RequestedAmount and TakeOverAmount are missing/invalid', {
                            essApplicationNumber: messageDetails.ApplicationNumber,
                            requestedAmount: messageDetails.RequestedAmount,
                            takeOverAmount: messageDetails.TakeOverAmount
                        });
                        return; // Skip processing if both amounts are invalid
                    }
                }
                
                const loanNumber = generateLoanNumber();
                const fspReferenceNumber = generateFSPReferenceNumber();
                
                // Use UTUMISHI's provided financial values when available, otherwise calculate
                const totalInterest = parseFloat(messageDetails.InterestRate) || (requestedAmount * 0.28 * (parseFloat(messageDetails.Tenure) || 12) / 12);
                const processingFee = parseFloat(messageDetails.ProcessingFee) || (requestedAmount * 0.02);
                const insurance = parseFloat(messageDetails.Insurance) || (requestedAmount * 0.015);
                const totalAmountToPay = requestedAmount + totalInterest;
                const otherCharges = processingFee + insurance;
                
                logger.info('💰 Using financial values', {
                    requestedAmount,
                    totalInterest,
                    processingFee,
                    insurance,
                    totalAmountToPay,
                    source: messageDetails.InterestRate ? 'UTUMISHI' : 'Calculated'
                });

                // Update existing loan mapping with approval details (mapping was created in Step 2)
                try {
                    const existingMapping = await LoanMappingService.getByEssApplicationNumber(messageDetails.ApplicationNumber);
                    if (existingMapping) {
                        await LoanMappingService.updateStatus(messageDetails.ApplicationNumber, 'OFFER_SUBMITTED', {
                            fspReferenceNumber: fspReferenceNumber,
                            essLoanNumberAlias: loanNumber,
                            totalAmountToPay: totalAmountToPay,
                            otherCharges: otherCharges,
                            metadata: {
                                ...(existingMapping.metadata || {}),
                                approvalDetails: {
                                    loanNumber,
                                    fspReferenceNumber,
                                    totalAmountToPay,
                                    otherCharges,
                                    approvedAt: new Date().toISOString()
                                }
                            }
                        });
                        logger.info('✅ Updated loan mapping with approval details for takeover offer');
                    } else {
                        // Fallback: Create new mapping if not found (shouldn't happen normally)
                        await LoanMappingService.createInitialMapping(
                            messageDetails.ApplicationNumber,
                            messageDetails.CheckNumber,
                            fspReferenceNumber,
                            {
                                essLoanNumberAlias: loanNumber,
                                requestedAmount: requestedAmount,
                                totalAmountToPay: totalAmountToPay,
                                interestRate: 28.0,
                                tenure: parseFloat(messageDetails.Tenure) || 12,
                                otherCharges: otherCharges,
                                status: 'OFFER_SUBMITTED'
                            }
                        );
                        logger.info('✅ Created new loan mapping for takeover offer (fallback)');
                    }
                } catch (mappingError) {
                    logger.error('❌ Error updating loan mapping for takeover:', mappingError);
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
                            "Reason": "Loan Takeover Request Approved",
                            "FSPReferenceNumber": fspReferenceNumber,
                            "LoanNumber": loanNumber,
                            "TotalAmountToPay": totalAmountToPay.toFixed(2),
                            "OtherCharges": otherCharges.toFixed(2),
                            "Approval": "APPROVED"
                        }
                    }
                };

                // Send callback using the callback utility
                await sendCallback(approvalResponseData);
                logger.info('✅ Successfully sent LOAN_INITIAL_APPROVAL_NOTIFICATION callback for takeover');
                
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
                logger.error('❌ Error sending LOAN_INITIAL_APPROVAL_NOTIFICATION callback for takeover:', callbackError);
                
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
        }, 10000); // 10 seconds delay

        logger.info('🕐 Scheduled LOAN_INITIAL_APPROVAL_NOTIFICATION to be sent in 10 seconds for takeover');

    } catch (error) {
        logger.error('Error processing loan takeover offer request:', error);
        return sendErrorResponse(res, '8012', error.message, 'xml', parsedData);
    }
};

module.exports = handleLoanTakeoverOfferRequest;
