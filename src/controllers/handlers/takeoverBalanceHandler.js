const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const { formatDateTimeForUTUMISHI } = require('../../utils/dateUtils');
const LoanMappingService = require('../../services/loanMappingService');
const api = require('../../services/cbs.api').maker;

/**
 * Handle TAKEOVER_PAY_OFF_BALANCE_REQUEST
 * Returns the payoff balance for loan takeover scenarios
 * 
 * IMPORTANT: If CheckNumber is provided, it identifies the CLIENT, not a specific loan.
 * One client can have multiple loans with the same check number.
 * ALWAYS use LoanNumber or ApplicationNumber for loan lookups.
 */
const handleTakeoverPayOffBalanceRequest = async (parsedData, res) => {
    try {
        logger.info('Processing TAKEOVER_PAY_OFF_BALANCE_REQUEST (synchronous)...');
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;
        const loanNumber = messageDetails.LoanNumber; // Unique loan identifier - required for lookup

        if (!loanNumber) {
            logger.error('LoanNumber is required for takeover payoff request');
            return sendErrorResponse(res, '8013', 'LoanNumber is required', 'xml', parsedData);
        }

        // Get loan details from MIFOS with repayment schedule
        let totalPayOffAmount = 0;
        let principalOutstanding = 0;
        let outstandingBalance = 0;
        let loanId = null;

        try {
            // CRITICAL: Search by loanNumber (unique loan identifier), NOT by checkNumber
            // checkNumber identifies the client and may be associated with multiple loans
            logger.info(`🔍 Searching for loan mapping with loan number: ${loanNumber}`);
            const loanMapping = await LoanMappingService.getByEssLoanNumberAlias(loanNumber);
            
            if (loanMapping && loanMapping.mifosLoanId) {
                loanId = loanMapping.mifosLoanId;
                logger.info(`✅ Found loan mapping - Mifos Loan ID: ${loanId}`);
            } else {
                // If not in mapping, try searching Mifos directly by external ID
                logger.info(`⚠️ Loan not in mapping database, searching Mifos by externalId: ${loanNumber}`);
                const searchResponse = await api.get(`/v1/loans?externalId=${loanNumber}&limit=1`);
                
                if (searchResponse.data && searchResponse.data.length > 0) {
                    loanId = searchResponse.data[0].id;
                    logger.info(`✅ Found loan in Mifos by externalId - Loan ID: ${loanId}`);
                }
            }
            
            if (loanId) {
                // Get detailed loan information with repayment schedule
                const loanResponse = await api.get(`/v1/loans/${loanId}?associations=repaymentSchedule`);
                const mifosLoanData = loanResponse.data;
                
                // Get principal outstanding from summary
                principalOutstanding = parseFloat(mifosLoanData.summary?.principalOutstanding || 0);
                outstandingBalance = parseFloat(mifosLoanData.summary?.totalOutstanding || 0);
                
                // Calculate 30 days interest from repayment schedule
                let thirtyDaysInterest = 0;
                
                if (mifosLoanData.repaymentSchedule?.periods) {
                    // Get unpaid periods from schedule
                    const unpaidPeriods = mifosLoanData.repaymentSchedule.periods.filter(
                        period => period.period && !period.complete && period.dueDate
                    );
                    
                    if (unpaidPeriods.length > 0) {
                        // Get the next unpaid period's interest
                        const nextPeriod = unpaidPeriods[0];
                        const periodInterest = parseFloat(nextPeriod.interestOriginalDue || nextPeriod.interestDue || 0);
                        
                        // Get period length in days
                        const periodStartDate = new Date(nextPeriod.fromDate || mifosLoanData.timeline?.expectedDisbursementDate);
                        const periodEndDate = new Date(nextPeriod.dueDate);
                        const periodDays = Math.max(1, (periodEndDate - periodStartDate) / (1000 * 60 * 60 * 24));
                        
                        // Calculate daily interest rate and multiply by 30
                        const dailyInterest = periodInterest / periodDays;
                        thirtyDaysInterest = dailyInterest * 30;
                        
                        logger.info(`📊 Schedule calculation - Period Interest: ${periodInterest}, Period Days: ${periodDays}, Daily: ${dailyInterest.toFixed(2)}, 30 Days: ${thirtyDaysInterest.toFixed(2)}`);
                    } else {
                        // Fallback to annual rate if no unpaid periods
                        const annualInterestRate = parseFloat(mifosLoanData.interestRatePerPeriod || 0);
                        thirtyDaysInterest = principalOutstanding * (annualInterestRate / 100) * (30 / 365);
                        logger.info(`⚠️ No unpaid periods, using annual rate calculation`);
                    }
                } else {
                    // Fallback to annual rate if schedule not available
                    const annualInterestRate = parseFloat(mifosLoanData.interestRatePerPeriod || 0);
                    thirtyDaysInterest = principalOutstanding * (annualInterestRate / 100) * (30 / 365);
                    logger.info(`⚠️ Schedule not available, using annual rate calculation`);
                }
                
                // Total payoff = Principal Outstanding + 30 days interest
                totalPayOffAmount = principalOutstanding + thirtyDaysInterest;
                
                logger.info(`💰 Calculated takeover amounts - Principal: ${principalOutstanding}, 30 Days Interest: ${thirtyDaysInterest.toFixed(2)}, Total Payoff: ${totalPayOffAmount.toFixed(2)}`);
            } else {
                logger.error('❌ Loan not found in MIFOS with externalId:', loanNumber);
                return sendErrorResponse(res, '8014', `Loan ${loanNumber} not found in MIFOS. Please ensure the loan is created and active.`, 'xml', parsedData);
            }
        } catch (mifosError) {
            logger.error('❌ Error fetching loan from MIFOS:', mifosError);
            return sendErrorResponse(res, '8015', `Error fetching loan from MIFOS: ${mifosError.message}`, 'xml', parsedData);
        }

        // Calculate dates for response
        const currentDate = new Date();
        const finalPaymentDate = new Date(currentDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
        const lastDeductionDate = new Date(currentDate.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
        const deductionEndDate = new Date(currentDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now

        // Build LOAN_TAKEOVER_BALANCE_RESPONSE
        const responseData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": "ESS_UTUMISHI",
                    "FSPCode": header.FSPCode,
                    "MsgId": header.MsgId,
                    "MessageType": "LOAN_TAKEOVER_BALANCE_RESPONSE"
                },
                MessageDetails: {
                    "LoanNumber": loanNumber,
                    "FSPCode": process.env.FSP_CODE || "FL8090",
                    "FSPReferenceNumber": messageDetails.FSPReferenceNumber || `FSP_${Date.now()}`,
                    "PaymentReferenceNumber": `PAY_${Date.now()}`,
                    "TotalPayOffAmount": totalPayOffAmount.toFixed(2),
                    "OutstandingBalance": outstandingBalance.toFixed(2),
                    "FSPBankAccount": "32310002165",
                    "FSPBankAccountName": "ZE DONE MICROFINANCE AND FINANCIAL CONSULTANCY",
                    "SWIFTCode": "NMIBTZTZ",
                    "MNOChannels": "255754730813",
                    "FinalPaymentDate": formatDateTimeForUTUMISHI(finalPaymentDate),
                    "LastDeductionDate": formatDateTimeForUTUMISHI(lastDeductionDate),
                    "DeductionEndDate": formatDateTimeForUTUMISHI(deductionEndDate)
                }
            }
        };

        logger.info('Returning LOAN_TAKEOVER_BALANCE_RESPONSE:', responseData.Data.MessageDetails);

        // Update loan mapping to track balance request
        try {
            const loanMapping = await LoanMappingService.getByEssLoanNumberAlias(loanNumber);
            if (loanMapping) {
                await LoanMappingService.updateStatus(loanMapping.essApplicationNumber, loanMapping.status, {
                    metadata: {
                        ...(loanMapping.metadata || {}),
                        balanceRequests: [
                            ...((loanMapping.metadata?.balanceRequests) || []),
                            {
                                type: 'TAKEOVER_PAY_OFF_BALANCE_REQUEST',
                                requestedAt: new Date(),
                                loanNumber: loanNumber,
                                totalPayOffAmount: totalPayOffAmount,
                                principalOutstanding: principalOutstanding,
                                outstandingBalance: outstandingBalance,
                                paymentReferenceNumber: responseData.Data.MessageDetails.PaymentReferenceNumber
                            }
                        ]
                    }
                });
                logger.info('✅ Updated loan mapping with takeover balance request details');
            }
        } catch (mappingError) {
            logger.warn('⚠️ Could not update loan mapping for balance request:', mappingError.message);
            // Don't fail the request if mapping update fails
        }

        // Sign and return synchronous response
        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        return res.status(200).set('Content-Type', 'application/xml').send(signedResponse);

    } catch (error) {
        logger.error('Error processing takeover pay off balance request:', error);
        return sendErrorResponse(res, '8012', error.message, 'xml', parsedData);
    }
};

module.exports = handleTakeoverPayOffBalanceRequest;
