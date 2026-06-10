const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const LOAN_CONSTANTS = require('../../utils/loanConstants');
const loanCalculations = require('../../utils/loanCalculations');
const LoanMapping = require('../../models/LoanMapping');
const cbsApi = require('../../services/cbs.api');

/**
 * Handle LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST
 * 
 * This handler calculates restructure affordability for existing loans.
 * It uses the total outstanding balance from MIFOS as the loan amount.
 * 
 * Input scenarios:
 * - Scenario A: Tenure is provided → Calculate EMI
 * - Scenario B: DesiredDeductibleAmount (EMI) is provided → Calculate Tenure
 * 
 * Note: This is SEPARATE from new loan and top-up flows which use loanOfferHandler.js
 */

const handleLoanRestructureAffordabilityRequest = async (parsedData, res) => {
    try {
        const header = parsedData.Document.Data.Header;
        const messageType = header.MessageType;
        logger.info(`Processing ${messageType}...`);
        
        // Import metrics tracking
        let trackLoanMessage, trackLoanError;
        try {
            const metrics = require('../../../src/middleware/metricsMiddleware');
            trackLoanMessage = metrics.trackLoanMessage;
            trackLoanError = metrics.trackLoanError;
        } catch (err) {
            // Metrics middleware not available, continue without tracking
        }
        
        const messageDetails = parsedData.Document.Data.MessageDetails;
        const loanNumber = messageDetails.LoanNumber;

        if (!loanNumber) {
            logger.error('LoanNumber is required for restructure affordability request');
            return sendErrorResponse(res, '8013', 'LoanNumber is required for loan restructure affordability', 'xml', parsedData);
        }

        logger.info(`Fetching existing loan: ${loanNumber}`);

        // Find the loan mapping
        const loanMapping = await LoanMapping.findOne({
            $or: [
                { fspReferenceNumber: loanNumber },
                { essLoanNumberAlias: loanNumber },
                { newLoanNumber: loanNumber }
            ]
        }).lean();

        if (!loanMapping) {
            logger.error(`Loan mapping not found for LoanNumber: ${loanNumber}`);
            return sendErrorResponse(res, '8014', `Loan not found: ${loanNumber}`, 'xml', parsedData);
        }

        if (!loanMapping.mifosLoanId) {
            logger.error(`MIFOS Loan ID not found in mapping for LoanNumber: ${loanNumber}`);
            return sendErrorResponse(res, '8015', 'MIFOS Loan ID not available', 'xml', parsedData);
        }

        logger.info(`Found loan mapping: mifosLoanId=${loanMapping.mifosLoanId}, status=${loanMapping.status}`);

        // Fetch loan details from MIFOS
        const api = cbsApi.maker;
        const loanResponse = await api.get(`/v1/loans/${loanMapping.mifosLoanId}?associations=repaymentSchedule,transactions`);

        if (!loanResponse.data) {
            logger.error(`MIFOS loan not found: ${loanMapping.mifosLoanId}`);
            return sendErrorResponse(res, '8016', 'Loan details not available from MIFOS', 'xml', parsedData);
        }

        const mifosLoan = loanResponse.data;
        
        // ============================================
        // RESTRUCTURE AFFORDABILITY CALCULATION
        // The loan amount = Total Outstanding Balance from MIFOS
        // ============================================
        const loanAmount = parseFloat(mifosLoan.summary?.totalOutstanding || 0);
        
        if (loanAmount <= 0) {
            logger.error(`Loan has no outstanding balance: ${loanNumber}`);
            return sendErrorResponse(res, '8017', 'Loan has no outstanding balance for restructuring', 'xml', parsedData);
        }

        logger.info(`MIFOS Loan: Status=${mifosLoan.status?.value}, Outstanding Balance (Loan Amount)=${loanAmount}`);

        // Parse input parameters - either Tenure OR DesiredDeductibleAmount (EMI) will be provided
        const providedTenure = messageDetails.Tenure !== undefined ? parseInt(messageDetails.Tenure) : 0;
        const providedEMI = messageDetails.DesiredDeductibleAmount !== undefined ? parseFloat(messageDetails.DesiredDeductibleAmount) : 0;
        
        // Interest rate from constants
        const interestRate = LOAN_CONSTANTS.DEFAULT_INTEREST_RATE;
        const maxTenure = LOAN_CONSTANTS.MAX_TENURE || 96;
        
        let calculatedTenure = 0;
        let calculatedEMI = 0;

        logger.info(`Input: ProvidedTenure=${providedTenure}, ProvidedEMI=${providedEMI}, LoanAmount=${loanAmount}, InterestRate=${interestRate}%`);

        // ============================================
        // SCENARIO A: Tenure is provided → Calculate EMI
        // SCENARIO B: EMI is provided → Calculate Tenure
        // ============================================
        if (providedTenure > 0) {
            // SCENARIO A: Tenure provided, calculate EMI
            calculatedTenure = Math.min(providedTenure, maxTenure);
            calculatedEMI = await loanCalculations.calculateEMI(loanAmount, interestRate, calculatedTenure);
            logger.info(`Scenario A (Tenure provided): Tenure=${calculatedTenure}, Calculated EMI=${calculatedEMI}`);
            
        } else if (providedEMI > 0) {
            // SCENARIO B: EMI provided, calculate Tenure
            calculatedEMI = providedEMI;
            calculatedTenure = await loanCalculations.calculateTenureFromEMI(loanAmount, interestRate, calculatedEMI);
            calculatedTenure = Math.min(calculatedTenure, maxTenure);
            
            // Recalculate EMI with capped tenure to ensure accuracy
            if (calculatedTenure === maxTenure) {
                calculatedEMI = await loanCalculations.calculateEMI(loanAmount, interestRate, calculatedTenure);
            }
            logger.info(`Scenario B (EMI provided): EMI=${calculatedEMI}, Calculated Tenure=${calculatedTenure}`);
            
        } else {
            // Neither provided - use default tenure
            calculatedTenure = LOAN_CONSTANTS.DEFAULT_TENURE || 96;
            calculatedEMI = await loanCalculations.calculateEMI(loanAmount, interestRate, calculatedTenure);
            logger.info(`Default: Using default tenure=${calculatedTenure}, EMI=${calculatedEMI}`);
        }

        // Validate calculations
        if (calculatedTenure <= 0 || calculatedEMI <= 0) {
            logger.error(`Invalid calculation results: Tenure=${calculatedTenure}, EMI=${calculatedEMI}`);
            return sendErrorResponse(res, '8018', 'Unable to calculate restructure terms', 'xml', parsedData);
        }

        // Calculate charges on the loan amount
        const charges = loanCalculations.calculateCharges(loanAmount);
        const totalProcessingFees = charges.processingFee;
        const totalInsurance = charges.insurance;
        const otherCharges = charges.otherCharges;

        // Total interest over the restructured tenure
        const totalInterestRateAmount = await loanCalculations.calculateTotalInterest(loanAmount, interestRate, calculatedTenure);
        
        // Update loan mapping to track restructure affordability request
        try {
            await LoanMapping.findOneAndUpdate(
                { _id: loanMapping._id },
                {
                    $set: {
                        'metadata.restructureAffordabilityRequests': [
                            ...((loanMapping.metadata?.restructureAffordabilityRequests) || []),
                            {
                                type: 'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST',
                                requestedAt: new Date(),
                                loanNumber: loanNumber,
                                loanAmount: loanAmount,
                                providedTenure: providedTenure,
                                providedEMI: providedEMI,
                                calculatedTenure: calculatedTenure,
                                calculatedEMI: calculatedEMI,
                                interestRate: interestRate,
                                totalInterestRateAmount: totalInterestRateAmount,
                                totalProcessingFees: totalProcessingFees,
                                totalInsurance: totalInsurance,
                                otherCharges: otherCharges
                            }
                        ]
                    }
                }
            );
            logger.info('✅ Updated loan mapping with restructure affordability request details');
        } catch (mappingError) {
            logger.warn('⚠️ Could not update loan mapping for restructure affordability request:', mappingError.message);
            // Don't fail the request if mapping update fails
        }
        
        // Net loan amount (after deducting fees)
        const totalDeductions = totalProcessingFees + totalInsurance + otherCharges;
        const netLoanAmount = loanAmount - totalDeductions;
        
        // Total amount to pay over the life of the restructured loan
        const totalAmountToPay = loanAmount + totalInterestRateAmount;

        logger.info(`Restructure Calculation Complete: LoanAmount=${loanAmount}, Tenure=${calculatedTenure}, EMI=${calculatedEMI}, TotalToPay=${totalAmountToPay}`);

        // Prepare response
        const responseData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": "ESS_UTUMISHI",
                    "FSPCode": header.FSPCode,
                    "MsgId": getMessageId('LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE'),
                    "MessageType": "LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE"
                },
                MessageDetails: {
                    "DesiredDeductibleAmount": calculatedEMI.toFixed(2),
                    "TotalInsurance": totalInsurance.toFixed(2),
                    "TotalProcessingFees": totalProcessingFees.toFixed(2),
                    "TotalInterestRateAmount": totalInterestRateAmount.toFixed(2),
                    "OtherCharges": otherCharges.toFixed(2),
                    "NetLoanAmount": netLoanAmount.toFixed(2),
                    "TotalAmountToPay": totalAmountToPay.toFixed(2),
                    "Tenure": calculatedTenure,
                    "EligibleAmount": loanAmount.toFixed(2),
                    "MonthlyReturnAmount": calculatedEMI.toFixed(2)
                }
            }
        };

        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        
        // Track successful processing
        if (trackLoanMessage) {
            trackLoanMessage(messageType, 'success');
            trackLoanMessage('LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE', 'sent');
        }
        
        logger.info(`LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE sent for ${loanNumber}`);
        res.status(200).set('Content-Type', 'application/xml').send(signedResponse);
        
    } catch (error) {
        logger.error('Error processing loan restructure affordability request:', error);
        
        // Track error
        let trackLoanError;
        try {
            const metrics = require('../../../src/middleware/metricsMiddleware');
            trackLoanError = metrics.trackLoanError;
        } catch (err) {
            logger.warn('Failed to load metrics middleware for error tracking', { error: err.message });
        }
        
        if (trackLoanError) {
            trackLoanError('processing_error', 'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST');
        }
        
        return sendErrorResponse(res, '8012', error.message, 'xml', parsedData);
    }
};

module.exports = handleLoanRestructureAffordabilityRequest;
