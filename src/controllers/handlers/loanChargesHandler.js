const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const LOAN_CONSTANTS = require('../../utils/loanConstants');
const loanCalculations = require('../../utils/loanCalculations');
const LoanMappingService = require('../../services/loanMappingService');
const PossibleLoanCharges = require('../../models/PossibleLoanCharges');
const { getActiveTenantContext } = require('../../utils/tenantContext');

// Import loanUtils functions directly to avoid path issues
const path = require('path');
const loanUtilsPath = path.resolve(__dirname, '../../utils/loanUtils.js');
const loanUtils = require(loanUtilsPath);

const handleLoanChargesRequest = async (parsedData, res) => {
    let possibleLoanChargesEntity = null;
    try {
        const header = parsedData.Document.Data.Header;
        const messageType = header.MessageType;
        logger.info(`Processing ${messageType}...`);
        
        // Import metrics tracking (dynamic import to avoid circular dependency)
        let trackLoanMessage, trackLoanError;
        try {
            const metrics = require('../../../src/middleware/metricsMiddleware');
            trackLoanMessage = metrics.trackLoanMessage;
            trackLoanError = metrics.trackLoanError;
        } catch (err) {
            // Metrics middleware not available, continue without tracking
        }
        const messageDetails = parsedData.Document.Data.MessageDetails;

        // Input validation - handle optional fields
        let requestedAmount = messageDetails.RequestedAmount !== undefined ? parseFloat(messageDetails.RequestedAmount || messageDetails.LoanAmount) : null;
        let requestedTenure = messageDetails.Tenure !== undefined ? parseInt(messageDetails.RequestedTenure || messageDetails.Tenure) : null;
        let deductibleAmount = messageDetails.DeductibleAmount !== undefined ? parseFloat(messageDetails.DeductibleAmount) : null;

        // Determine affordability type based on presence of RequestedAmount
        const affordabilityType = (requestedAmount === null || requestedAmount === 0) ? 'REVERSE' : 'FORWARD';

        // Tenant-scoped product lookup - source of the calculation rates AND the "quoted"
        // snapshot written onto the LoanMapping below (so apiController.js's actual MIFOS
        // loan-creation step can book the loan at the same rate that was quoted here,
        // instead of a hardcoded value - see LoanMapping.quotedInterestRate etc.).
        // No LOAN_CONSTANTS fallback - a missing/inactive product throws (caught below,
        // returned as an explicit 8019 error response) rather than silently calculating
        // off a global default.
        const quotedProductCode = messageDetails.ProductCode || '17';
        const { product: matchedProduct, interestRate, processingFeeRate, insuranceRate, otherCharges: otherChargesAmount, maxTenure } =
            await loanUtils.resolveProductForCalculation(quotedProductCode);

        // Set defaults and validate tenure
        if (requestedTenure === null || requestedTenure === 0) {
            if (affordabilityType === 'FORWARD') {
                requestedTenure = maxTenure;
                logger.info(`Tenure not provided but RequestedAmount >0, defaulting to product's max tenure: ${requestedTenure} months`);
            } else {
                requestedTenure = null; // Will be determined by reverse calculation
                logger.info(`Tenure not provided for reverse calculation, will optimize`);
            }
        }

        // Validate retirement if tenure is set
        if (requestedTenure !== null) {
            const retirementMonthsLeft = loanUtils.calculateMonthsUntilRetirement(messageDetails.RetirementDate);
            requestedTenure = loanUtils.validateRetirementAge(requestedTenure, retirementMonthsLeft, { maxTenure });
            if (!requestedTenure || requestedTenure <= 0) {
                requestedTenure = maxTenure;
                logger.info(`Tenure adjusted for retirement: ${requestedTenure} months`);
            }
        }

        // Repayment capacity - handle optional DeductibleAmount
        const desiredDeductibleAmount = parseFloat(messageDetails.DesiredDeductibleAmount || 0);
        const oneThirdAmount = parseFloat(messageDetails.OneThirdAmount || 0);
        const MIN_LOAN_AMOUNT = LOAN_CONSTANTS.MIN_LOAN_AMOUNT;

        // Calculate maxAffordableEMI based on available deduction capacity
        let maxAffordableEMI = 0;
        if (deductibleAmount !== null && deductibleAmount > 0) {
            maxAffordableEMI = deductibleAmount;
        } else if (oneThirdAmount > 0) {
            maxAffordableEMI = oneThirdAmount; // Fallback to 1/3 rule
        } else {
            maxAffordableEMI = 0; // No deduction limit provided
        }

        // Calculate desirableEMI (capped desired deduction)
        let desirableEMI = 0;
        if (desiredDeductibleAmount > 0) {
            desirableEMI = Math.min(desiredDeductibleAmount, maxAffordableEMI);
        } else {
            desirableEMI = maxAffordableEMI;
        }

        logger.info(`AffordabilityType: ${affordabilityType}, RequestedAmount: ${requestedAmount}, Tenure: ${requestedTenure}, DeductibleAmount: ${deductibleAmount}, MaxAffordableEMI: ${maxAffordableEMI}`);

        // Persist incoming LOAN_CHARGES_REQUEST to MongoDB (tenant-scoped audit trail).
        // Degrades safely to an untenanted record if no tenant context is resolved,
        // matching LoanMappingService's scoping pattern.
        if (messageDetails.CheckNumber) {
            try {
                const tenantId = getActiveTenantContext()?.tenantId || null;
                possibleLoanChargesEntity = await PossibleLoanCharges.create({
                    ...(tenantId ? { tenantId } : {}),
                    productCode: messageDetails.ProductCode || '17',
                    idNumber: messageDetails.CheckNumber,
                    idNumberType: 'CHECK_NUMBER',
                    applicationNumber: messageDetails.ApplicationNumber,
                    requestedAmount: requestedAmount,
                    requestedTenure: requestedTenure,
                    deductibleAmount: deductibleAmount,
                    desiredDeductibleAmount: desiredDeductibleAmount,
                    affordabilityType: affordabilityType,
                    request: JSON.stringify(messageDetails),
                    status: 'PENDING'
                });
                logger.info(`PossibleLoanCharges record created: ${possibleLoanChargesEntity._id}`);
            } catch (dbError) {
                logger.warn('Failed to persist LOAN_CHARGES_REQUEST:', dbError.message);
            }
        }

        // Ensure tenure is set for calculations
        if (requestedTenure === null) {
            if (affordabilityType === 'REVERSE') {
                // For reverse calculation, optimize tenure to maximize eligible amount
                // Try different tenures and find the one that gives maximum loan amount
                let maxEligibleAmount = 0;
                let optimalTenure = maxTenure;
                let optimalMonthlyReturn = desirableEMI;

                // Generate tenure options in 12-month increments up to this tenant's
                // configured cap (falls back to the matched product's own maxTenure when
                // no tenant-level override is resolved, e.g. legacy/untenanted requests).
                const maxTenureMonths = getActiveTenantContext()?.maxTenureMonths || maxTenure;
                const possibleTenures = [];
                for (let t = 12; t <= maxTenureMonths; t += 12) {
                    possibleTenures.push(t);
                }
                if (possibleTenures.length === 0) {
                    possibleTenures.push(maxTenureMonths);
                }
                for (const tenure of possibleTenures) {
                    const testLoanAmount = await loanCalculations.calculateMaxLoanFromEMI(desirableEMI, interestRate, tenure);
                    if (testLoanAmount > maxEligibleAmount) {
                        maxEligibleAmount = testLoanAmount;
                        optimalTenure = tenure;
                    }
                }
                requestedTenure = optimalTenure;
                logger.info(`Optimized tenure for reverse calculation: ${requestedTenure} months, MaxEligibleAmount: ${maxEligibleAmount}`);
            } else {
                requestedTenure = maxTenure;
            }
        }

        // Calculate max affordable loan amount
        const maxAffordableLoan = await loanCalculations.calculateMaxLoanFromEMI(desirableEMI, interestRate, requestedTenure);

        let eligibleAmount = 0;
        let monthlyReturnAmount = 0;

        if (affordabilityType === 'FORWARD') {
            // Forward: RequestedAmount is the desired NET loan amount (what borrower wants to receive)
            // We need to calculate the gross amount (eligible amount) that will yield this net amount
            
            // Step 1: Calculate what gross amount would be needed to achieve the requested net amount
            // Formula: GrossAmount = NetAmount / (1 - totalFeeRate)
            const totalFeeRate = processingFeeRate + insuranceRate;

            // Calculate required gross amount: (RequestedNet + OtherCharges) / (1 - percentageFees)
            const requiredGrossAmount = (requestedAmount + otherChargesAmount) / (1 - totalFeeRate);
            
            // Step 2: Check if this gross amount fits within EMI capacity
            const requestedEMI = await loanCalculations.calculateEMI(requiredGrossAmount, interestRate, requestedTenure);
            
            // Step 3: Determine final eligibleAmount based on EMI capacity
            if (requestedEMI <= maxAffordableEMI && requiredGrossAmount <= maxAffordableLoan) {
                // Requested amount fits within capacity
                eligibleAmount = requiredGrossAmount;
                monthlyReturnAmount = requestedEMI;
                logger.info(`Forward calculation: RequestedNet=${requestedAmount}, RequiredGross=${requiredGrossAmount.toFixed(2)}, EMI=${requestedEMI.toFixed(2)}, within capacity`);
            } else {
                // Requested amount exceeds capacity, use maximum affordable
                eligibleAmount = maxAffordableLoan;
                monthlyReturnAmount = desirableEMI;
                logger.info(`Forward calculation (EMI-capped): RequestedNet=${requestedAmount} requires EMI=${requestedEMI.toFixed(2)} but max is ${maxAffordableEMI}, using MaxAffordable=${maxAffordableLoan.toFixed(2)}`);
            }
        } else {
            // Reverse: Maximize eligibility within EMI capacity
            eligibleAmount = maxAffordableLoan;
            monthlyReturnAmount = desirableEMI;
            logger.info(`Reverse calculation: EligibleAmount=${eligibleAmount}, MonthlyReturnAmount=${monthlyReturnAmount}`);
        }

        // Final validation: Ensure EMI doesn't exceed maxAffordableEMI (safety check)
        if (monthlyReturnAmount > maxAffordableEMI) {
            // This should not happen with the improved logic above, but keep as safety net
            eligibleAmount = await loanCalculations.calculateMaxLoanFromEMI(maxAffordableEMI, interestRate, requestedTenure);
            monthlyReturnAmount = maxAffordableEMI;
            logger.warn(`Safety EMI cap triggered: EligibleAmount=${eligibleAmount}, MonthlyReturnAmount=${monthlyReturnAmount}`);
        }

        // Ensure minimum loan amount
        eligibleAmount = Math.max(eligibleAmount, MIN_LOAN_AMOUNT);

        // Calculate charges modularly using eligibleAmount
        const charges = loanCalculations.calculateCharges(eligibleAmount, processingFeeRate, insuranceRate, otherChargesAmount);
        const totalProcessingFees = charges.processingFee;
        const totalInsurance = charges.insurance;
        const otherCharges = charges.otherCharges;

        // Interest and net loan using eligibleAmount
        const totalInterestRateAmount = await loanCalculations.calculateTotalInterest(eligibleAmount, interestRate, requestedTenure);
        const totalDeductions = totalProcessingFees + totalInsurance + otherCharges;
        const netLoanAmount = eligibleAmount - totalDeductions;
        const totalAmountToPay = eligibleAmount + totalInterestRateAmount;

        // Update loan mapping to track charges request
        try {
            if (messageDetails.ApplicationNumber || messageDetails.CheckNumber) {
                const identifier = messageDetails.ApplicationNumber || messageDetails.CheckNumber;
                let mapping = null;
                
                try {
                    mapping = await LoanMappingService.getByEssApplicationNumber(identifier);
                } catch (e) {
                    // No mapping found, continue without tracking
                    logger.info('No existing loan mapping found for charges request');
                }

                if (!mapping) {
                    // No mapping found, try to create one from charges request data
                    // so later messages (LOAN_OFFER_REQUEST, etc.) for the same
                    // application have something to correlate against.
                    // Tenant-scoped via LoanMappingService's own resolveTenantId/
                    // applyWriteScope (ambient context, degrades to untenanted if none).
                    logger.info('No existing loan mapping found for charges request, creating new mapping');
                    try {
                        const loanNumber = loanUtils.generateLoanNumber();
                        const fspRefNumber = loanUtils.generateFSPReferenceNumber();

                        mapping = await LoanMappingService.createInitialMapping(
                            identifier,
                            messageDetails.CheckNumber,
                            fspRefNumber,
                            {
                                essLoanNumberAlias: loanNumber,
                                productCode: messageDetails.ProductCode || '17',
                                requestedAmount: requestedAmount || eligibleAmount,
                                tenure: requestedTenure,
                                status: 'CHARGES_CALCULATED',
                                metadata: {
                                    createdFromChargesRequest: true,
                                    chargesRequestAt: new Date().toISOString()
                                }
                            }
                        );
                        logger.info('✅ Created loan mapping from LOAN_CHARGES_REQUEST for application:', identifier);
                    } catch (mappingCreationError) {
                        logger.warn('Unable to create mapping from charges request:', mappingCreationError.message);
                        // Continue without mapping if creation fails
                    }
                }

                if (mapping) {
                    // Snapshot the quoted rates onto the mapping so apiController.js's actual
                    // MIFOS loan-creation step can book at what was quoted here, not a fresh
                    // (possibly since-changed) Product lookup or a hardcoded value.
                    // resolveProductForCalculation() above throws (caught by this handler's
                    // outer try/catch, response never reaches here) when no product matches -
                    // so by the time this code runs, matchedProduct is always a real record.
                    // Runs on every charges request for this mapping (new or existing), so a
                    // repeat request always refreshes to the latest quote.
                    const quoteSnapshot = {
                        quotedMifosProductId: matchedProduct.mifosProductId,
                        quotedInterestRate: matchedProduct.interestRate,
                        quotedProcessingFee: matchedProduct.processingFee,
                        quotedInsurance: matchedProduct.insurance,
                        quotedOtherCharges: matchedProduct.otherCharges,
                        quotedAt: new Date()
                    };

                    await LoanMappingService.updateStatus(mapping.essApplicationNumber, mapping.status, {
                        ...quoteSnapshot,
                        totalAmountToPay: totalAmountToPay,
                        metadata: {
                            ...(mapping.metadata || {}),
                            chargesRequests: [
                                ...((mapping.metadata?.chargesRequests) || []),
                                {
                                    type: messageType,
                                    requestedAt: new Date(),
                                    requestedAmount: requestedAmount,
                                    tenure: requestedTenure,
                                    eligibleAmount: eligibleAmount,
                                    monthlyReturnAmount: monthlyReturnAmount,
                                    totalProcessingFees: totalProcessingFees,
                                    totalInsurance: totalInsurance,
                                    otherCharges: otherCharges,
                                    affordabilityType: affordabilityType,
                                    netLoanAmount: netLoanAmount,
                                    totalAmountToPay: totalAmountToPay
                                }
                            ]
                        }
                    });
                    logger.info('✅ Updated loan mapping with charges request details');
                }
            }
        } catch (mappingError) {
            logger.warn('⚠️ Could not update loan mapping for charges request:', mappingError.message);
            // Don't fail the request if mapping update fails
        }

        // Prepare response - dynamic response type based on request type
        const responseType = messageType === 'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST' 
            ? 'LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE' 
            : 'LOAN_CHARGES_RESPONSE';
        const msgIdPrefix = messageType === 'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST'
            ? 'LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE'
            : 'LOAN_CHARGES_RESPONSE';
            
        const responseData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": "ESS_UTUMISHI",
                    "FSPCode": header.FSPCode,
                    "MsgId": getMessageId(msgIdPrefix),
                    "MessageType": responseType
                },
                MessageDetails: {
                    "DesiredDeductibleAmount": monthlyReturnAmount.toFixed(2),
                    "TotalInsurance": totalInsurance.toFixed(2),
                    "TotalProcessingFees": totalProcessingFees.toFixed(2),
                    "TotalInterestRateAmount": totalInterestRateAmount.toFixed(2),
                    "OtherCharges": otherCharges.toFixed(2),
                    "NetLoanAmount": netLoanAmount.toFixed(2),
                    "TotalAmountToPay": totalAmountToPay.toFixed(2),
                    "Tenure": requestedTenure,
                    "EligibleAmount": eligibleAmount.toFixed(2),
                    "MonthlyReturnAmount": monthlyReturnAmount.toFixed(2)
                }
            }
        };

        // Update PossibleLoanCharges record with calculated results
        if (possibleLoanChargesEntity) {
            try {
                await possibleLoanChargesEntity.updateOne({
                    requestedTenure: requestedTenure,
                    eligibleAmount: eligibleAmount,
                    monthlyReturnAmount: monthlyReturnAmount,
                    totalProcessingFees: totalProcessingFees,
                    totalInsurance: totalInsurance,
                    otherCharges: otherCharges,
                    totalInterestRateAmount: totalInterestRateAmount,
                    netLoanAmount: netLoanAmount,
                    totalAmountToPay: totalAmountToPay,
                    affordabilityType: affordabilityType,
                    response: JSON.stringify(responseData.Data.MessageDetails),
                    status: 'COMPLETED',
                    updatedAt: new Date()
                });
                logger.info(`PossibleLoanCharges record updated: ${possibleLoanChargesEntity._id}`);
            } catch (dbError) {
                logger.warn('Failed to update PossibleLoanCharges with results:', dbError.message);
            }
        }

        // Store charge calculation results for later use
        try {
            const checkNumber = messageDetails.CheckNumber;
            if (checkNumber) {
                const chargeCalculationData = {
                    totalAmountToPay: totalAmountToPay.toFixed(2),
                    otherCharges: otherCharges.toFixed(2),
                    totalInsurance: totalInsurance.toFixed(2),
                    totalProcessingFees: totalProcessingFees.toFixed(2),
                    totalInterestRateAmount: totalInterestRateAmount.toFixed(2),
                    netLoanAmount: netLoanAmount.toFixed(2),
                    eligibleAmount: eligibleAmount.toFixed(2),
                    tenure: requestedTenure,
                    calculatedAt: new Date().toISOString()
                };
                await LoanMappingService.storeChargeCalculation(checkNumber, chargeCalculationData);
                logger.info('Stored charge calculation data for CheckNumber:', checkNumber);
            }
        } catch (storageError) {
            logger.warn('Failed to store charge calculation data:', storageError.message);
        }

        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        
        // Track successful loan message processing
        if (trackLoanMessage) {
            trackLoanMessage(messageType, 'success');
            // Track outgoing response message
            trackLoanMessage('LOAN_CHARGES_RESPONSE', 'sent');
        }
        
        res.status(200).send(signedResponse);
    } catch (error) {
        logger.error('Error processing loan charges request:', error);

        // Mark PossibleLoanCharges record as failed
        if (possibleLoanChargesEntity) {
            try {
                await possibleLoanChargesEntity.updateOne({
                    status: 'FAILED',
                    errorMessage: error.message,
                    updatedAt: new Date()
                });
            } catch (dbErr) { /* silent */ }
        }

        // Track loan processing error
        if (trackLoanError) {
            trackLoanError('processing_error', header?.MessageType || 'unknown');
        }

        // ApplicationException (e.g. resolveProductForCalculation's "no matching product")
        // carries its own specific errorCode - use it instead of the generic 8012 so the
        // caller gets a meaningful reason rather than a blanket "try later".
        return sendErrorResponse(res, error.errorCode || '8012', error.message, 'xml', parsedData);
    }
};

module.exports = handleLoanChargesRequest;