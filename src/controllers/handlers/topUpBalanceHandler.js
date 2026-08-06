const logger = require('../../utils/logger');
const digitalSignature = require('../../utils/signatureUtils');
const { sendErrorResponse } = require('../../utils/responseUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const { formatDateTimeForUTUMISHI } = require('../../utils/dateUtils');
const LoanMappingService = require('../../services/loanMappingService');
const api = require('../../services/cbs.api').maker;

/**
 * Handle TOP_UP_PAY_0FF_BALANCE_REQUEST
 * Returns the payoff balance for an existing loan to support top-up loans
 * 
 * IMPORTANT: Check number is unique per CLIENT, NOT per loan.
 * One client can have multiple loans with the same check number.
 * ALWAYS use loanNumber or applicationNumber for loan lookups, NEVER checkNumber alone.
 */
const handleTopUpPayOffBalanceRequest = async (parsedData, res) => {
    try {
        logger.info('Processing TOP_UP_PAY_0FF_BALANCE_REQUEST...');
        
        const header = parsedData.Document.Data.Header;
        const messageDetails = parsedData.Document.Data.MessageDetails;
        
        // Extract request data
        // NOTE: checkNumber is for client identification only, NOT for loan lookup
        const checkNumber = messageDetails.CheckNumber; // Client identifier (not unique per loan)
        const loanNumber = messageDetails.LoanNumber;   // Unique loan identifier - USE THIS for lookup
        const firstName = messageDetails.FirstName;
        const middleName = messageDetails.MiddleName;
        const lastName = messageDetails.LastName;
        
        logger.info('Top-up balance request details:', {
            checkNumber,
            loanNumber,
            name: `${firstName} ${middleName} ${lastName}`
        });

        // Find loan mapping to get MIFOS loan ID
        // CRITICAL: Use loanNumber for lookup, NOT checkNumber (which can map to multiple loans)
        let mifosLoanId;
        let fspReferenceNumber;
        let loanData = null;
        
        // Try multiple strategies to find the loan (all based on loanNumber)
        try {
            // Strategy 1: Check loan mapping by ESS loan number alias (primary key)
            const loanMapping = await LoanMappingService.getByEssLoanNumberAlias(loanNumber);
            
            if (loanMapping && loanMapping.mifosLoanId) {
                mifosLoanId = loanMapping.mifosLoanId;
                fspReferenceNumber = loanMapping.fspReferenceNumber || loanMapping.essApplicationNumber;
                logger.info('Found loan mapping:', { mifosLoanId, fspReferenceNumber });
            } else {
                logger.info('No loan mapping found, trying alternative lookup strategies...');
                
                // Strategy 2: Search Mifos loans by external ID
                try {
                    const searchResponse = await api.get(`/v1/loans?externalId=${loanNumber}&limit=1`);
                    if (searchResponse.data?.pageItems && searchResponse.data.pageItems.length > 0) {
                        const foundLoan = searchResponse.data.pageItems[0];
                        mifosLoanId = foundLoan.id;
                        fspReferenceNumber = foundLoan.externalId || loanNumber;
                        logger.info('Found loan by external ID:', { mifosLoanId, externalId: foundLoan.externalId });
                    }
                } catch (searchError) {
                    logger.warn('Search by external ID failed:', searchError.message);
                }
                
                // Strategy 3: Search by account number if external ID search failed
                if (!mifosLoanId) {
                    try {
                        const accountSearchResponse = await api.get(`/v1/loans?accountNo=${loanNumber}&limit=1`);
                        if (accountSearchResponse.data?.pageItems && accountSearchResponse.data.pageItems.length > 0) {
                            const foundLoan = accountSearchResponse.data.pageItems[0];
                            mifosLoanId = foundLoan.id;
                            fspReferenceNumber = foundLoan.accountNo || loanNumber;
                            logger.info('Found loan by account number:', { mifosLoanId, accountNo: foundLoan.accountNo });
                        }
                    } catch (accountSearchError) {
                        logger.warn('Search by account number failed:', accountSearchError.message);
                    }
                }
                
                // Strategy 4: If still not found, check if loanNumber is actually a numeric Mifos ID
                if (!mifosLoanId && /^\d+$/.test(loanNumber)) {
                    mifosLoanId = loanNumber;
                    fspReferenceNumber = loanNumber;
                    logger.info('Treating loan number as numeric Mifos ID:', { mifosLoanId });
                }
            }
        } catch (mappingError) {
            logger.error('Loan mapping lookup failed:', mappingError.message);
            
            // Last resort: try numeric ID if loan number is numeric
            if (/^\d+$/.test(loanNumber)) {
                mifosLoanId = loanNumber;
                fspReferenceNumber = loanNumber;
                logger.info('Using loan number as fallback Mifos ID:', { mifosLoanId });
            }
        }
        
        // If we still haven't found a valid loan ID, return proper error response
        if (!mifosLoanId) {
            logger.error('Could not determine Mifos loan ID for:', { loanNumber, checkNumber });
            
            const errorResponseData = {
                Data: {
                    Header: {
                        "Sender": process.env.FSP_NAME || "ZE DONE",
                        "Receiver": "ESS_UTUMISHI",
                        "FSPCode": header.FSPCode,
                        "MsgId": getMessageId("RESPONSE"),
                        "MessageType": "RESPONSE"
                    },
                    MessageDetails: {
                        "ResponseCode": "8005",
                        "Description": "Loan not found in system",
                        "OriginalMsgId": header.MsgId,
                        "OriginalMessageType": header.MessageType
                    }
                }
            };
            
            const signedErrorResponse = digitalSignature.createSignedXML(errorResponseData.Data);
            return res.status(200).send(signedErrorResponse);
        }

        // Fetch loan details from MIFOS
        const loanResponse = await api.get(`/v1/loans/${mifosLoanId}?associations=all`);
        
        // Check if loan data was retrieved
        if (!loanResponse || !loanResponse.data || !loanResponse.data.id) {
            logger.error('Loan not found in MIFOS after lookup:', { 
                mifosLoanId, 
                originalLoanNumber: loanNumber
            });
            
            const errorResponseData = {
                Data: {
                    Header: {
                        "Sender": process.env.FSP_NAME || "ZE DONE",
                        "Receiver": "ESS_UTUMISHI",
                        "FSPCode": header.FSPCode,
                        "MsgId": getMessageId("RESPONSE"),
                        "MessageType": "RESPONSE"
                    },
                    MessageDetails: {
                        "ResponseCode": "8005",
                        "Description": "Loan not found in Core Banking System",
                        "OriginalMsgId": header.MsgId,
                        "OriginalMessageType": header.MessageType,
                        "LoanNumber": loanNumber
                    }
                }
            };
            
            const signedErrorResponse = digitalSignature.createSignedXML(errorResponseData.Data);
            return res.status(200).send(signedErrorResponse);
        }

        loanData = loanResponse.data;
        logger.info('Loan data retrieved from MIFOS:', {
            id: loanData.id,
            accountNo: loanData.accountNo,
            status: loanData.status?.value,
            principal: loanData.principal,
            totalOutstanding: loanData.summary?.totalOutstanding
        });

        // Calculate dates (7 days from today for validity)
        const currentDate = new Date();
        const finalPaymentDate = new Date(currentDate);
        finalPaymentDate.setDate(finalPaymentDate.getDate() + 7);
        
        // Extract loan financial data
        const totalOutstanding = loanData.summary?.totalOutstanding || 0;
        const principalOutstanding = loanData.summary?.principalOutstanding || 0;
        const feeChargesOutstanding = loanData.summary?.feeChargesOutstanding || 0;
        const penaltyChargesOutstanding = loanData.summary?.penaltyChargesOutstanding || 0;
        
        // For top-up/payoff: ONLY use principal outstanding
        // Do NOT include future unearned interest - customer should only pay what they borrowed
        // Add any actual fees or penalties that have been charged
        const totalPayoffAmount = principalOutstanding + feeChargesOutstanding + penaltyChargesOutstanding;
        
        // Get last transaction dates
        const lastDeductionDate = loanData.timeline?.expectedDisbursementDate 
            ? new Date(loanData.timeline.expectedDisbursementDate)
            : new Date(currentDate);
            
        const lastPayDate = loanData.timeline?.actualDisbursementDate 
            ? new Date(loanData.timeline.actualDisbursementDate)
            : new Date(currentDate);

        logger.info('Calculated payoff details:', {
            totalPayoffAmount: totalPayoffAmount.toFixed(2),
            principalOutstanding: principalOutstanding.toFixed(2),
            note: 'Payoff amount = Principal Outstanding only (no future interest)'
        });

        // Generate unique payment reference
        const paymentReferenceNumber = `TOPUP_${Date.now()}_${mifosLoanId}`;

        // Build LOAN_TOP_UP_BALANCE_RESPONSE
        const responseData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": "ESS_UTUMISHI",
                    "FSPCode": header.FSPCode,
                    "MsgId": getMessageId('LOAN_TOP_UP_BALANCE_RESPONSE'),
                    "MessageType": "LOAN_TOP_UP_BALANCE_RESPONSE"
                },
                MessageDetails: {
                    "LoanNumber": loanNumber,
                    "FSPReferenceNumber": fspReferenceNumber,
                    "PaymentReferenceNumber": paymentReferenceNumber,
                    "TotalPayoffAmount": totalPayoffAmount.toFixed(2),
                    "OutstandingBalance": principalOutstanding.toFixed(2),
                    "FinalPaymentDate": formatDateTimeForUTUMISHI(finalPaymentDate),
                    "LastDeductionDate": formatDateTimeForUTUMISHI(lastDeductionDate),
                    "LastPayDate": formatDateTimeForUTUMISHI(lastPayDate),
                    "EndDate": formatDateTimeForUTUMISHI(finalPaymentDate)
                }
            }
        };

        logger.info('Sending LOAN_TOP_UP_BALANCE_RESPONSE:', responseData.Data.MessageDetails);

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
                                type: 'TOP_UP_PAY_0FF_BALANCE_REQUEST',
                                requestedAt: new Date(),
                                checkNumber: checkNumber,
                                totalPayoffAmount: totalPayoffAmount,
                                principalOutstanding: principalOutstanding,
                                paymentReferenceNumber: paymentReferenceNumber
                            }
                        ]
                    }
                });
                logger.info('✅ Updated loan mapping with balance request details');
            }
        } catch (mappingError) {
            logger.warn('⚠️ Could not update loan mapping for balance request:', mappingError.message);
            // Don't fail the request if mapping update fails
        }

        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        res.status(200).send(signedResponse);

    } catch (error) {
        logger.error('Error processing TOP_UP_PAY_0FF_BALANCE_REQUEST:', error);
        return sendErrorResponse(res, '8002', `Processing error: ${error.message}`, 'xml', parsedData);
    }
};

module.exports = handleTopUpPayOffBalanceRequest;
