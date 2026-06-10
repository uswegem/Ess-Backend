const logger = require('../../utils/logger');
const { maker } = require('../../services/cbs.api');
const digitalSignature = require('../../utils/signatureUtils');
const { getMessageId } = require('../../utils/messageIdGenerator');
const LoanMapping = require('../../models/LoanMapping');
const AuditLog = require('../../models/AuditLog');

/**
 * Handle LOAN_RESTRUCTURE_REQUEST
 * Calls MIFOS reschedule API and sets up webhook to send LOAN_INITIAL_APPROVAL_NOTIFICATION
 */
const handleLoanRestructureRequest = async (parsedData, res) => {
    let responseSent = false;

    try {
        const data = parsedData.Document.Data;
        const header = data.Header;
        const messageDetails = data.MessageDetails;

        logger.info('🔄 Processing LOAN_RESTRUCTURE_REQUEST:', {
            checkNumber: messageDetails.CheckNumber,
            loanNumber: messageDetails.LoanNumber || 'Not provided',
            applicationNumber: messageDetails.ApplicationNumber || 'Not provided',
            tenure: messageDetails.Tenure,
            requestedAmount: messageDetails.RequestedAmount
        });

        // Extract request parameters
        const checkNumber = messageDetails.CheckNumber;
        const loanNumber = messageDetails.LoanNumber; // Primary identifier for the specific loan to restructure
        const tenure = parseInt(messageDetails.Tenure || 0);
        const desiredDeductibleAmount = parseFloat(messageDetails.DesiredDeductibleAmount || 0);
        const restructureApplicationNumber = messageDetails.ApplicationNumber; // New ApplicationNumber from UTUMISHI for restructure

        // Validate required fields - LoanNumber is critical since customer may have multiple loans
        if (!loanNumber) {
            throw new Error('LoanNumber is required to identify the specific loan to restructure');
        }

        if (!tenure || tenure <= 0) {
            throw new Error('Tenure must be greater than 0');
        }

        // Find the SPECIFIC loan mapping using Loan Number (primary identifier)
        // Customer may have multiple loans, so we identify by the specific loan number
        logger.info('🔍 Searching for specific loan to restructure:', {
            loanNumber: loanNumber,
            checkNumber: checkNumber
        });

        let loanMapping = await LoanMapping.findOne({
            $or: [
                { essLoanNumberAlias: loanNumber },           // FSP-generated loan number
                { fspReferenceNumber: loanNumber },           // FSP reference number
                { newLoanNumber: loanNumber },                // New loan number (from previous restructure)
                { mifosLoanAccountNumber: loanNumber },       // MIFOS account number
                // Fallback to CheckNumber only if LoanNumber doesn't match
                { 
                    $and: [
                        { $or: [{ checkNumber: checkNumber }, { essCheckNumber: checkNumber }] },
                        { status: { $nin: ['CANCELLED', 'REJECTED', 'CLOSED'] } }
                    ]
                }
            ]
        }).sort({ createdAt: -1 }); // Get most recent if multiple matches

        if (!loanMapping) {
            logger.error('❌ Loan mapping not found:', {
                loanNumber: loanNumber,
                checkNumber: checkNumber
            });
            throw new Error(`No active loan found for loan number: ${loanNumber}`);
        }

        logger.info('✅ Found specific loan for restructuring:', {
            mappingId: loanMapping._id,
            essLoanNumberAlias: loanMapping.essLoanNumberAlias,
            checkNumber: loanMapping.essCheckNumber,
            mifosLoanId: loanMapping.mifosLoanId,
            currentStatus: loanMapping.status
        });

        logger.info('✅ Found specific loan for restructuring:', {
            mappingId: loanMapping._id,
            essLoanNumberAlias: loanMapping.essLoanNumberAlias,
            checkNumber: loanMapping.essCheckNumber,
            mifosLoanId: loanMapping.mifosLoanId,
            currentStatus: loanMapping.status
        });

        if (!loanMapping.mifosLoanId) {
            throw new Error('MIFOS Loan ID not found in loan mapping - cannot restructure loan without MIFOS ID');
        }

        logger.info('📞 Fetching loan details from MIFOS:', {
            mifosLoanId: loanMapping.mifosLoanId
        });

        // Fetch existing loan details from MIFOS
        const api = maker;
        const loanResponse = await api.get(`/v1/loans/${loanMapping.mifosLoanId}?associations=repaymentSchedule,transactions`);

        if (!loanResponse.data) {
            logger.error(`MIFOS loan not found: ${loanMapping.mifosLoanId}`);
            throw new Error('Loan details not available from MIFOS');
        }

        const mifosLoan = loanResponse.data;
        const existingLoanAmount = parseFloat(mifosLoan.principal || 0);
        const currentOutstanding = parseFloat(mifosLoan.summary?.totalOutstanding || 0);

        logger.info(`MIFOS Loan Details: Principal=${existingLoanAmount}, Outstanding=${currentOutstanding}, Status=${mifosLoan.status?.value}`);

        // Use existing loan amount for restructure calculations
        const requestedAmount = existingLoanAmount;

        // Step 1: Send immediate ACK response
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
                    "Description": "Loan restructure request received and being processed"
                }
            }
        };

        const signedResponse = digitalSignature.createSignedXML(ackResponseData.Data);
        res.status(200).send(signedResponse);
        responseSent = true;
        logger.info('✅ Sent immediate ACK response for LOAN_RESTRUCTURE_REQUEST');

        // Step 2: Calculate restructured loan details
        logger.info('🧮 Calculating restructured loan details...');
        
        const interestRate = 24.0; // 24% per annum (same as regular loans)
        const totalInterestRateAmount = (requestedAmount * interestRate * tenure) / (12 * 100);
        const totalAmountToPay = requestedAmount + totalInterestRateAmount;
        const otherCharges = 50000; // Standard charges

        logger.info('Calculated restructure details:', {
            existingLoanAmount,
            currentOutstanding,
            newTenure: tenure,
            interestRate,
            totalInterestRateAmount,
            totalAmountToPay,
            otherCharges
        });

        // Generate new loan/reference numbers for restructure
        const { generateLoanNumber, generateFSPReferenceNumber } = require('../../utils/loanUtils');
        const newLoanNumber = generateLoanNumber();
        const newFspReferenceNumber = generateFSPReferenceNumber();

        // Update loan mapping with restructure info
        await LoanMapping.updateOne(
            { _id: loanMapping._id },
            {
                $set: {
                    originalMessageType: 'LOAN_RESTRUCTURE_REQUEST', // Set original message type
                    isRestructure: true,
                    restructureRequested: true,
                    restructureDate: new Date(),
                    restructureApplicationNumber: restructureApplicationNumber, // Store new ApplicationNumber from UTUMISHI
                    newTenure: tenure,
                    existingLoanAmount: existingLoanAmount,
                    currentOutstanding: currentOutstanding,
                    newTotalAmountToPay: totalAmountToPay,
                    newInterestRate: interestRate,
                    newOtherCharges: otherCharges,
                    newLoanNumber: newLoanNumber,
                    newFspReferenceNumber: newFspReferenceNumber,
                    status: 'RESTRUCTURE_INITIAL_APPROVAL_SENT',
                    desiredDeductibleAmount: desiredDeductibleAmount
                }
            }
        );

        logger.info('✅ Updated loan mapping with restructure details');

        // Create audit log (optional - don't fail if it doesn't work)
        try {
            await AuditLog.create({
                userId: null, // System action, no user
                action: 'api_call',
                description: `Loan restructure requested for check ${checkNumber}`,
                eventType: 'LOAN_RESTRUCTURE_REQUESTED',
                data: {
                    checkNumber,
                    originalLoanNumber: loanMapping.loanNumber,
                    existingLoanAmount,
                    currentOutstanding,
                    newTenure: tenure,
                    newLoanNumber,
                    mifosLoanId: loanMapping.mifosLoanId,
                    totalAmountToPay
                }
            });
        } catch (auditError) {
            logger.warn('Failed to create audit log for restructure request:', auditError.message);
            // Continue with the process even if audit logging fails
        }

        // Step 3: Send LOAN_INITIAL_APPROVAL_NOTIFICATION callback
        logger.info('📤 Sending LOAN_INITIAL_APPROVAL_NOTIFICATION for restructure...');
        
        setTimeout(async () => {
            try {
                const { sendCallback } = require('../../utils/callbackUtils');
                
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
                            "ApplicationNumber": restructureApplicationNumber || loanMapping.applicationNumber || loanMapping.essApplicationNumber,
                            "Reason": "Loan Restructure Request Approved",
                            "FSPReferenceNumber": newFspReferenceNumber,
                            "LoanNumber": newLoanNumber,
                            "TotalAmountToPay": totalAmountToPay.toFixed(2),
                            "OtherCharges": otherCharges.toFixed(2),
                            "Approval": "APPROVED"
                        }
                    }
                };

                await sendCallback(approvalResponseData);
                logger.info('✅ LOAN_INITIAL_APPROVAL_NOTIFICATION sent successfully for restructure');
                
                // Track callback in loan mapping
                try {
                    await LoanMapping.updateOne(
                        { _id: loanMapping._id },
                        {
                            $set: {
                                'metadata.callbacksSent': [
                                    ...((loanMapping.metadata?.callbacksSent) || []),
                                    {
                                        type: 'LOAN_INITIAL_APPROVAL_NOTIFICATION',
                                        sentAt: new Date(),
                                        status: 'success',
                                        loanNumber: newLoanNumber,
                                        fspReferenceNumber: newFspReferenceNumber,
                                        context: 'loan-restructure'
                                    }
                                ]
                            }
                        }
                    );
                } catch (trackError) {
                    logger.warn('⚠️ Could not track callback in mapping:', trackError.message);
                }

                // Update mapping status
                await LoanMapping.updateOne(
                    { _id: loanMapping._id },
                    {
                        $set: {
                            status: 'RESTRUCTURE_INITIAL_APPROVAL_SENT',
                            initialApprovalSentAt: new Date()
                        }
                    }
                );

            } catch (callbackError) {
                logger.error('❌ Error sending LOAN_INITIAL_APPROVAL_NOTIFICATION for restructure:', callbackError);
            }
        }, 20000); // 20 seconds delay

    } catch (error) {
        logger.error('❌ Error processing LOAN_RESTRUCTURE_REQUEST:', error);
        
        if (!responseSent) {
            // Send error response
            const errorResponseData = {
                Data: {
                    Header: {
                        "Sender": process.env.FSP_NAME || "ZE DONE",
                        "Receiver": "ESS_UTUMISHI",
                        "FSPCode": parsedData.Document.Data.Header.FSPCode,
                        "MsgId": getMessageId("RESPONSE"),
                        "MessageType": "RESPONSE"
                    },
                    MessageDetails: {
                        "ResponseCode": "8005",
                        "Description": `Loan restructure failed: ${error.message}`
                    }
                }
            };
            
            const signedErrorResponse = digitalSignature.createSignedXML(errorResponseData.Data);
            res.set('Content-Type', 'application/xml');
            res.status(200).send(signedErrorResponse);
        }
    }
};

/**
 * Calculate adjusted due date based on new tenure
 */
function calculateAdjustedDueDate(tenureMonths) {
    const today = new Date();
    const adjustedDate = new Date(today.setMonth(today.getMonth() + tenureMonths));
    return adjustedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

module.exports = handleLoanRestructureRequest;
