const mongoose = require('mongoose');
const axios = require('axios');
const { signXML } = require('./src/utils/xmlSigner');
const logger = require('./src/utils/logger');
require('dotenv').config();

const generateFSPReferenceNumber = () => `FSP${Date.now()}`;
const generateLoanNumber = () => `LOAN${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function resendApproval() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connected to MongoDB');

        const LoanMapping = require('./src/models/LoanMapping');
        const loan = await LoanMapping.findOne({ essApplicationNumber: 'ESS1766476759636' });

        if (!loan) {
            logger.error('Loan not found');
            process.exit(1);
        }

        logger.info('Found loan:', {
            applicationNumber: loan.essApplicationNumber,
            requestedAmount: loan.requestedAmount,
            tenure: loan.tenure,
            status: loan.status
        });

        // Generate new reference numbers
        const fspReferenceNumber = generateFSPReferenceNumber();
        const loanNumber = generateLoanNumber();

        // Calculate charges (28% annual interest)
        const requestedAmount = loan.requestedAmount || 2999999.99;
        const tenure = loan.tenure || 96;
        const totalAmountToPay = requestedAmount + (requestedAmount * 0.28 * tenure / 12);
        const processingFee = requestedAmount * 0.01;
        const insurance = requestedAmount * 0.005;
        const otherCharges = processingFee + insurance;

        logger.info('Calculated charges:', {
            requestedAmount,
            tenure,
            totalAmountToPay,
            otherCharges
        });

        // Create approval message
        const messageData = {
            Data: {
                Header: {
                    Sender: 'ZE DONE',
                    Receiver: 'ESS_UTUMISHI',
                    FSPCode: process.env.FSP_CODE || 'FL8090',
                    MsgId: `LIAN_ZD${Date.now()}`,
                    MessageType: 'LOAN_INITIAL_APPROVAL_NOTIFICATION'
                },
                MessageDetails: {
                    ApplicationNumber: loan.essApplicationNumber,
                    Reason: 'Loan Takeover Request Approved',
                    FSPReferenceNumber: fspReferenceNumber,
                    LoanNumber: loanNumber,
                    TotalAmountToPay: totalAmountToPay.toFixed(2),
                    OtherCharges: otherCharges.toFixed(2),
                    Approval: 'APPROVED'
                }
            }
        };

        logger.info('Approval message created:', messageData);

        // Sign the message
        const signedXml = await signXML(messageData);
        logger.info('XML signed successfully');

        // Send to UTUMISHI
        const callbackUrl = process.env.ESS_CALLBACK_URL || 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume';
        
        logger.info('Sending approval to UTUMISHI:', { url: callbackUrl });

        const response = await axios.post(callbackUrl, signedXml, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 30000
        });

        logger.info('✅ UTUMISHI Response:', {
            status: response.status,
            statusText: response.statusText,
            data: response.data
        });

        // Update loan mapping
        await LoanMapping.updateOne(
            { essApplicationNumber: loan.essApplicationNumber },
            {
                $set: {
                    essLoanNumberAlias: loanNumber,
                    essFSPReferenceNumber: fspReferenceNumber
                },
                $push: {
                    'metadata.callbacksSent': {
                        type: 'LOAN_INITIAL_APPROVAL_NOTIFICATION',
                        sentAt: new Date(),
                        status: 'success',
                        loanNumber,
                        fspReferenceNumber,
                        responseCode: response.status
                    }
                }
            }
        );

        logger.info('✅ Loan mapping updated successfully');

    } catch (error) {
        logger.error('❌ Error resending approval:', error.message);
        if (error.response) {
            logger.error('Response error:', error.response.data);
        }
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

resendApproval();
