const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { trackLoanMessage, trackLoanError } = require('../../middleware/metricsMiddleware');
const { sendCallback } = require('../../utils/callbackUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const LOAN_CONSTANTS = require('../../utils/loanConstants');
const LoanCalculations = require('../../utils/loanCalculations');
const { generateLoanNumber, generateFSPReferenceNumber } = require('../../utils/loanUtils');
const LoanMappingService = require('../../services/loanMappingService');
const cbsApi = require('../../services/cbs.api');

// Helper function to calculate monthly installment
const calculateMonthlyInstallment = LoanCalculations.calculateMonthlyInstallment.bind(LoanCalculations);

/**
 * Check if customer has active loans in CBS
 * @param {string} nin - Customer NIN
 * @returns {Object|null} - Active loan details or null
 */
async function checkForActiveLoans(nin) {
    try {
        if (!nin) {
            logger.info('⚠️ No NIN provided, cannot check for active loans');
            return null;
        }
        
        logger.info('🔍 Checking for active loans for NIN:', nin);
        
        // Search for customer in CBS by NIN (external ID)
        const searchResponse = await cbsApi.maker.get(`/v1/clients?externalId=${nin}`);
        
        if (!searchResponse || !searchResponse.data || searchResponse.data.totalFilteredRecords === 0) {
            logger.info('✅ No existing customer found in CBS');
            return null;
        }
        
        const customer = searchResponse.data.pageItems[0];
        logger.info('📋 Customer found in CBS:', {
            id: customer.id,
            accountNo: customer.accountNo,
            name: customer.displayName
        });
        
        // Get all accounts for customer (includes loans)
        const accountsResponse = await cbsApi.maker.get(`/v1/clients/${customer.id}/accounts`);
        
        if (!accountsResponse || !accountsResponse.data || !accountsResponse.data.loanAccounts) {
            logger.info('✅ No loan accounts found for customer');
            return null;
        }
        
        const loanAccounts = accountsResponse.data.loanAccounts;
        
        if (!loanAccounts || loanAccounts.length === 0) {
            logger.info('✅ No loans found for customer');
            return null;
        }
        
        // Filter active loans (status.id === 300 means Active)
        const activeLoans = loanAccounts.filter(loan => loan.status && loan.status.id === 300);
        
        if (activeLoans.length === 0) {
            logger.info('✅ No active loans found (may have closed loans)');
            return null;
        }
        
        logger.info('⚠️ Active loan(s) detected:', {
            count: activeLoans.length,
            loans: activeLoans.map(l => ({
                id: l.id,
                accountNo: l.accountNo,
                productName: l.productName,
                principal: l.originalLoan,
                status: l.status.value
            }))
        });
        
        // Return first active loan (system supports 1 loan per customer)
        return {
            customer: customer,
            activeLoan: activeLoans[0],
            activeLoansCount: activeLoans.length
        };
        
    } catch (error) {
        logger.error('❌ Error checking for active loans:', {
            message: error.message,
            stack: error.stack
        });
        return null; // On error, proceed as normal loan
    }
}

/**
 * Handle automatic top-up when active loan is detected
 */
async function handleTopUpOfferRequestAuto(parsedData, res, clientData, loanData, employmentData, activeLoanInfo) {
    try {
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;
        
        logger.info('📊 Processing automatic TOP-UP with active loan:', {
            activeLoanId: activeLoanInfo.activeLoan.id,
            activeLoanAccount: activeLoanInfo.activeLoan.accountNo,
            activeLoanPrincipal: activeLoanInfo.activeLoan.originalLoan,
            customerName: activeLoanInfo.customer.displayName
        });
        
        // Update loan data with top-up info
        loanData.productCode = 'TOPUP';
        loanData.existingLoanNumber = activeLoanInfo.activeLoan.accountNo;
        loanData.existingLoanId = activeLoanInfo.activeLoan.id;
        
        // Store data with top-up flag
        try {
            await LoanMappingService.createOrUpdateWithClientData(
                messageDetails.ApplicationNumber,
                messageDetails.CheckNumber,
                clientData,
                loanData,
                employmentData
            );
            logger.info('✅ Auto-detected top-up client data stored successfully');
        } catch (storageError) {
            logger.error('❌ Error storing auto top-up client data:', storageError);
            // Continue with response even if storage fails
        }
        
        // Send immediate ACK
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
                    "Description": "Success - Top-up detected automatically"
                }
            }
        };
        
        const ackSignedResponse = digitalSignature.createSignedXML(ackResponseData.Data);
        trackLoanMessage('LOAN_OFFER_ACK_RESPONSE', 'sent');
        res.status(200).send(ackSignedResponse);
        logger.info('✅ Sent ACK for auto-detected top-up');
        
        // Schedule LOAN_INITIAL_APPROVAL_NOTIFICATION callback
        setTimeout(async () => {
            try {
                logger.info('⏰ Sending LOAN_INITIAL_APPROVAL_NOTIFICATION for auto-detected top-up...');
                
                // Calculate loan offer with proper tenure defaulting
                let offerTenure = parseInt(messageDetails.Tenure);
                if (!offerTenure || offerTenure === 0) {
                    offerTenure = LOAN_CONSTANTS.MAX_TENURE;
                    logger.info(`Tenure not provided, defaulting to maximum: ${offerTenure} months`);
                }
                
                // Determine loan amount
                let requestedAmount = parseFloat(messageDetails.RequestedAmount) || 0;
                const maxAffordableEMI = parseFloat(messageDetails.DesiredDeductibleAmount || messageDetails.DeductibleAmount || messageDetails.OneThirdAmount || 0);
                
                const interestRate = LOAN_CONSTANTS.DEFAULT_INTEREST_RATE;
                
                // Calculate or adjust loan amount based on affordability
                if (requestedAmount > 0 && maxAffordableEMI > 0) {
                    const calculatedEMI = await LoanCalculations.calculateEMI(requestedAmount, interestRate, offerTenure);
                    if (calculatedEMI > maxAffordableEMI) {
                        const adjustedAmount = await LoanCalculations.calculateMaxLoanFromEMI(maxAffordableEMI, interestRate, offerTenure);
                        requestedAmount = Math.max(LOAN_CONSTANTS.MIN_LOAN_AMOUNT, Math.round(adjustedAmount));
                        logger.info(`⚠️ Adjusted top-up amount from ${messageDetails.RequestedAmount} to ${requestedAmount} based on affordability`);
                    }
                } else if (requestedAmount === 0 && maxAffordableEMI > 0) {
                    const maxLoanAmount = await LoanCalculations.calculateMaxLoanFromEMI(maxAffordableEMI, interestRate, offerTenure);
                    requestedAmount = Math.max(LOAN_CONSTANTS.MIN_LOAN_AMOUNT, Math.round(maxLoanAmount));
                    logger.info(`Calculated top-up amount from affordability: ${requestedAmount}`);
                } else {
                    requestedAmount = Math.max(requestedAmount, LOAN_CONSTANTS.MIN_LOAN_AMOUNT);
                }
                
                const loanAmount = requestedAmount;
                const totalInterestRateAmount = await LoanCalculations.calculateTotalInterest(loanAmount, interestRate, offerTenure);
                const charges = LoanCalculations.calculateCharges(loanAmount);
                const totalAmountToPay = loanAmount + totalInterestRateAmount;
                const otherCharges = charges.otherCharges;
                const loanNumber = generateLoanNumber();
                const fspReferenceNumber = generateFSPReferenceNumber();
                
                // Update loan mapping with approval details
                try {
                    await LoanMappingService.createInitialMapping(
                        messageDetails.ApplicationNumber,
                        messageDetails.CheckNumber,
                        fspReferenceNumber,
                        {
                            essLoanNumberAlias: loanNumber,
                            productCode: "TOPUP",
                            requestedAmount: loanAmount,
                            totalAmountToPay: totalAmountToPay,
                            interestRate: interestRate,
                            tenure: offerTenure,
                            otherCharges: otherCharges,
                            status: 'INITIAL_APPROVAL_SENT',
                            mifosClientId: activeLoanInfo.customer.id,
                            existingLoanId: activeLoanInfo.activeLoan.id
                        }
                    );
                    logger.info('✅ Created loan mapping for auto-detected top-up');
                } catch (mappingError) {
                    logger.error('❌ Error creating loan mapping for auto top-up:', mappingError);
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
                            "Reason": "Top-Up Loan Approved (Auto-detected existing loan)",
                            "FSPReferenceNumber": fspReferenceNumber,
                            "LoanNumber": loanNumber,
                            "TotalAmountToPay": totalAmountToPay.toFixed(2),
                            "OtherCharges": otherCharges.toFixed(2),
                            "Approval": "APPROVED"
                        }
                    }
                };
                
                await sendCallback(approvalResponseData);
                trackLoanMessage('LOAN_INITIAL_APPROVAL_NOTIFICATION', 'sent');
                logger.info('✅ Sent LOAN_INITIAL_APPROVAL_NOTIFICATION for auto-detected top-up');
                
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
                                        fspReferenceNumber: fspReferenceNumber,
                                        context: 'auto-detected-top-up'
                                    }
                                ]
                            }
                        });
                    }
                } catch (trackError) {
                    logger.warn('⚠️ Could not track callback in mapping:', trackError.message);
                }
                
            } catch (callbackError) {
                logger.error('❌ Error sending auto top-up callback:', callbackError);
                trackLoanError('LOAN_INITIAL_APPROVAL_NOTIFICATION', callbackError.message);
                
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
                                        error: callbackError.message,
                                        context: 'auto-detected-top-up'
                                    }
                                ]
                            }
                        });
                    }
                } catch (trackError) {
                    logger.warn('⚠️ Could not track failed callback:', trackError.message);
                }
            }
        }, 20000);
        
    } catch (error) {
        logger.error('❌ Error in auto top-up processing:', error);
        throw error;
    }
}

const handleLoanOfferRequest = async (parsedData, res) => {
    try {
        logger.info('Processing LOAN_OFFER_REQUEST...');
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;

        // Store client data for later use during final approval
            // Extract all client data fields with logging
            logger.info('Extracting client data from request...');
            logger.info('NIN from request:', messageDetails.NIN);

            const clientData = {
                checkNumber: messageDetails.CheckNumber,
                firstName: messageDetails.FirstName,
                middleName: messageDetails.MiddleName,
                lastName: messageDetails.LastName,
                fullName: `${messageDetails.FirstName || ''} ${messageDetails.MiddleName || ''} ${messageDetails.LastName || ''}`.trim(),
                sex: messageDetails.Sex,
                nin: messageDetails.NIN || messageDetails.Nin || messageDetails.NationalId, // Try multiple possible field names
                bankAccountNumber: messageDetails.BankAccountNumber,
                employmentDate: messageDetails.EmploymentDate,
                maritalStatus: messageDetails.MaritalStatus,
                confirmationDate: messageDetails.ConfirmationDate,
                physicalAddress: messageDetails.PhysicalAddress,
                emailAddress: messageDetails.EmailAddress,
                mobileNumber: messageDetails.MobileNumber,
                applicationNumber: messageDetails.ApplicationNumber,
                swiftCode: messageDetails.SwiftCode
            };

            logger.info('Extracted client data:', JSON.stringify(clientData, null, 2));        // Store loan and employment data
        const loanData = {
            requestedAmount: messageDetails.RequestedAmount,
            desiredDeductibleAmount: messageDetails.DesiredDeductibleAmount,
            tenure: messageDetails.Tenure,
            productCode: messageDetails.ProductCode,
            interestRate: messageDetails.InterestRate,
            processingFee: messageDetails.ProcessingFee,
            insurance: messageDetails.Insurance,
            loanPurpose: messageDetails.LoanPurpose,
            contractStartDate: messageDetails.ContractStartDate,
            contractEndDate: messageDetails.ContractEndDate,
            funding: messageDetails.Funding
        };

        const employmentData = {
            designationCode: messageDetails.DesignationCode,
            designationName: messageDetails.DesignationName,
            basicSalary: messageDetails.BasicSalary,
            netSalary: messageDetails.NetSalary,
            oneThirdAmount: messageDetails.OneThirdAmount,
            totalEmployeeDeduction: messageDetails.TotalEmployeeDeduction,
            retirementDate: messageDetails.RetirementDate,
            termsOfEmployment: messageDetails.TermsOfEmployment,
            voteCode: messageDetails.VoteCode,
            voteName: messageDetails.VoteName,
            nearestBranchName: messageDetails.NearestBranchName,
            nearestBranchCode: messageDetails.NearestBranchCode
        };

        // Check for active loans before processing
        const activeLoanInfo = await checkForActiveLoans(clientData.nin);

        if (activeLoanInfo) {
            logger.info('🔄 Customer has active loan - automatically treating as TOP-UP request');
            
            // Process as top-up offer request
            return await handleTopUpOfferRequestAuto(
                parsedData, 
                res, 
                clientData, 
                loanData, 
                employmentData,
                activeLoanInfo
            );
        }

        logger.info('✅ No active loan found - processing as regular LOAN_OFFER_REQUEST');

        // Calculate loan offer immediately with proper tenure defaulting
        let offerTenure = parseInt(messageDetails.Tenure);
        if (!offerTenure || offerTenure === 0) {
            offerTenure = LOAN_CONSTANTS.MAX_TENURE;
            logger.info(`Tenure not provided or is 0, defaulting to maximum tenure: ${offerTenure} months`);
        }

        // Determine maximum affordable EMI from available data
        // CONSERVATIVE APPROACH: DesiredDeductibleAmount must be capped at DeductibleAmount
        let maxAffordableEMI = 0;
        const deductibleAmountOffer = parseFloat(messageDetails.DeductibleAmount || 0);
        const desiredDeductibleAmountOffer = parseFloat(messageDetails.DesiredDeductibleAmount || 0);

        if (desiredDeductibleAmountOffer > 0) {
            // Cap desired amount at system-calculated capacity
            if (deductibleAmountOffer > 0 && desiredDeductibleAmountOffer > deductibleAmountOffer) {
                maxAffordableEMI = deductibleAmountOffer;
                logger.info(`⚠️ DesiredDeductibleAmount (${desiredDeductibleAmountOffer}) exceeds DeductibleAmount (${deductibleAmountOffer}). Capped at DeductibleAmount for safety.`);
            } else {
                maxAffordableEMI = desiredDeductibleAmountOffer;
                logger.info(`Using DesiredDeductibleAmount as max affordable EMI: ${maxAffordableEMI}`);
            }
        } else if (deductibleAmountOffer > 0) {
            maxAffordableEMI = deductibleAmountOffer;
            logger.info(`Using DeductibleAmount as max affordable EMI: ${maxAffordableEMI}`);
        } else if (messageDetails.OneThirdAmount && messageDetails.OneThirdAmount > 0) {
            maxAffordableEMI = messageDetails.OneThirdAmount;
            logger.info(`Using OneThirdAmount as max affordable EMI: ${maxAffordableEMI}`);
        } else if (messageDetails.NetSalary && messageDetails.NetSalary > 0) {
            maxAffordableEMI = messageDetails.NetSalary * 0.33; // Fallback to 1/3 of net salary
            logger.info(`Calculated max affordable EMI as 1/3 of NetSalary: ${maxAffordableEMI}`);
        }

        let requestedAmount = messageDetails.RequestedAmount || 0;

        // Use consistent interest rate from constants
        const interestRate = LOAN_CONSTANTS.DEFAULT_INTEREST_RATE;
        
        // If requested amount is provided, validate it doesn't exceed affordability
        if (requestedAmount > 0 && maxAffordableEMI > 0) {
            const calculatedEMI = await LoanCalculations.calculateEMI(requestedAmount, interestRate, offerTenure);
            logger.info(`Requested amount: ${requestedAmount}, Calculated EMI: ${calculatedEMI.toFixed(2)}, Max affordable: ${maxAffordableEMI}`);

            if (calculatedEMI > maxAffordableEMI) {
                // Adjust loan amount downward to fit within customer's maximum capacity
                const adjustedAmount = await LoanCalculations.calculateMaxLoanFromEMI(maxAffordableEMI, interestRate, offerTenure);
                requestedAmount = Math.max(LOAN_CONSTANTS.MIN_LOAN_AMOUNT, Math.round(adjustedAmount));
                logger.info(`⚠️ Requested amount exceeds affordability. Adjusted from ${messageDetails.RequestedAmount} to ${requestedAmount} (EMI: ${maxAffordableEMI})`);
            }
        } else if (requestedAmount === 0 && maxAffordableEMI > 0) {
            // Calculate maximum loan from affordability (same logic as REVERSE calculation)
            const maxLoanAmount = await LoanCalculations.calculateMaxLoanFromEMI(maxAffordableEMI, interestRate, offerTenure);
            requestedAmount = Math.round(maxLoanAmount);
            requestedAmount = Math.max(requestedAmount, LOAN_CONSTANTS.MIN_LOAN_AMOUNT);
            logger.info(`Calculated loan amount from affordability: ${requestedAmount} (EMI: ${maxAffordableEMI})`);
        } else {
            // No affordability data, use minimum loan amount
            requestedAmount = Math.max(requestedAmount, LOAN_CONSTANTS.MIN_LOAN_AMOUNT);
            logger.info(`Using minimum loan amount: ${requestedAmount}`);
        }

        const loanOffer = {
            LoanAmount: requestedAmount,
            InterestRate: interestRate, // Use consistent rate from constants
            Tenure: offerTenure,
            MonthlyInstallment: await LoanCalculations.calculateEMI(
                requestedAmount,
                interestRate,
                offerTenure
            )
        };

        logger.info('Final loan offer:', loanOffer);

        // Calculate TotalAmountToPay and OtherCharges using same logic as LOAN_CHARGES_REQUEST
        const loanAmount = parseFloat(loanOffer.LoanAmount) || 0;
        const offerInterestRate = parseFloat(loanOffer.InterestRate) || 0;
        const tenure = parseFloat(loanOffer.Tenure) || 0;

        // Use same calculation logic as LOAN_CHARGES_REQUEST
        const totalInterestRateAmount = await LoanCalculations.calculateTotalInterest(loanAmount, offerInterestRate, tenure);
        const charges = LoanCalculations.calculateCharges(loanAmount);
        const totalProcessingFees = charges.processingFee;
        const totalInsurance = charges.insurance;
        const otherCharges = charges.otherCharges;
        const totalAmountToPay = loanAmount + totalInterestRateAmount;
        const loanNumber = generateLoanNumber();

        logger.info(`Calculated using LOAN_CHARGES_REQUEST logic - LoanAmount: ${loanAmount}, TotalAmountToPay: ${totalAmountToPay}, OtherCharges: ${otherCharges}`);

        // Store in loan mapping with all client, loan, and employment data
        logger.info('💾 Storing client data for application:', messageDetails.ApplicationNumber);
        try {
            await LoanMappingService.createOrUpdateWithClientData(
                messageDetails.ApplicationNumber,
                messageDetails.CheckNumber,
                clientData,
                loanData,
                employmentData,
                'LOAN_OFFER_REQUEST' // Set original message type
            );
            logger.info('✅ Client data stored successfully');
        } catch (storageError) {
            logger.error('❌ Error storing client data:', storageError);
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
        trackLoanMessage('LOAN_OFFER_ACK_RESPONSE', 'sent');
        res.status(200).send(ackSignedResponse);
        logger.info('✅ Sent immediate ACK response for LOAN_OFFER_REQUEST');

        // Schedule LOAN_INITIAL_APPROVAL_NOTIFICATION to be sent via callback after 20 seconds
        setTimeout(async () => {
            try {
                logger.info('⏰ Sending delayed LOAN_INITIAL_APPROVAL_NOTIFICATION callback...');

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
                            "Reason": "Loan Request Approved",
                            "FSPReferenceNumber": header.FSPReferenceNumber || messageDetails.CheckNumber || messageDetails.ApplicationNumber,
                            "LoanNumber": loanNumber,
                            "TotalAmountToPay": totalAmountToPay.toFixed(2),
                            "OtherCharges": otherCharges.toFixed(2),
                            "Approval": "APPROVED"
                        }
                    }
                };

                // Send callback using the callback utility
                await sendCallback(approvalResponseData);
                trackLoanMessage('LOAN_INITIAL_APPROVAL_NOTIFICATION', 'sent');
                logger.info('✅ Successfully sent LOAN_INITIAL_APPROVAL_NOTIFICATION callback');
                
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
                                        fspReferenceNumber: fspReferenceNumber,
                                        context: 'standard-loan-offer'
                                    }
                                ]
                            }
                        });
                    }
                } catch (trackError) {
                    logger.warn('⚠️ Could not track callback in mapping:', trackError.message);
                }

            } catch (callbackError) {
                logger.error('❌ Error sending LOAN_INITIAL_APPROVAL_NOTIFICATION callback:', callbackError);
                
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
                                        error: callbackError.message,
                                        context: 'standard-loan-offer'
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

        logger.info('🕐 Scheduled LOAN_INITIAL_APPROVAL_NOTIFICATION to be sent in 20 seconds');

    } catch (error) {
        logger.error('Error processing loan offer request:', error);
        return sendErrorResponse(res, '8012', error.message, 'xml', parsedData);
    }
};

module.exports = handleLoanOfferRequest;