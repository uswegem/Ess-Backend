const mongoose = require('mongoose');
const axios = require('axios');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/signatureUtils');
const { generateLoanNumber, generateFSPReferenceNumber } = require('./src/utils/loanUtils');
require('dotenv').config();

/**
 * Manually update loan mapping with restructure data from UTUMISHI request
 * and send LOAN_INITIAL_APPROVAL_NOTIFICATION
 */

const restructureData = {
    checkNumber: '11915366',
    applicationNumber: 'ESS1766142923684', // NEW ApplicationNumber from UTUMISHI
    loanNumber: 'LOAN1766054808065',
    fspReferenceNumber: 'FSP1766054808065',
    tenure: 18,
    requestedAmount: 1500000.00,
    desiredDeductibleAmount: 125000.00,
    interestRate: 360000.00,
    processingFee: 30000.00,
    insurance: 50000.00
};

console.log('🔄 MANUALLY UPDATING LOAN MAPPING AND SENDING CALLBACK');
console.log('='.repeat(70));
console.log('Check Number:', restructureData.checkNumber);
console.log('New Application Number:', restructureData.applicationNumber);
console.log('Loan Number:', restructureData.loanNumber);

async function updateAndSendCallback() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ess');
        const LoanMapping = require('./src/models/LoanMapping');
        
        // Find the loan by check number
        const loan = await LoanMapping.findOne({
            $or: [
                { checkNumber: restructureData.checkNumber },
                { essCheckNumber: restructureData.checkNumber }
            ]
        });

        if (!loan) {
            console.log('❌ Loan not found for check number:', restructureData.checkNumber);
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log('\n✅ Found loan mapping');
        console.log('Original Application Number:', loan.applicationNumber || loan.essApplicationNumber);
        console.log('MIFOS Loan ID:', loan.mifosLoanId);

        // Calculate restructure details
        const requestedAmount = restructureData.requestedAmount;
        const totalInterestRateAmount = restructureData.interestRate;
        const processingFee = restructureData.processingFee;
        const insurance = restructureData.insurance;
        const otherCharges = processingFee + insurance;
        const totalAmountToPay = requestedAmount + totalInterestRateAmount + otherCharges;

        console.log('\n📊 CALCULATED RESTRUCTURE DETAILS:');
        console.log('Requested Amount:', requestedAmount.toFixed(2));
        console.log('Interest Rate Amount:', totalInterestRateAmount.toFixed(2));
        console.log('Processing Fee:', processingFee.toFixed(2));
        console.log('Insurance:', insurance.toFixed(2));
        console.log('Other Charges:', otherCharges.toFixed(2));
        console.log('Total Amount to Pay:', totalAmountToPay.toFixed(2));
        console.log('Tenure:', restructureData.tenure, 'months');

        // Generate new loan/reference numbers for restructure
        const newLoanNumber = generateLoanNumber();
        const newFspReferenceNumber = generateFSPReferenceNumber();

        console.log('\n🆕 NEW LOAN DETAILS:');
        console.log('New Loan Number:', newLoanNumber);
        console.log('New FSP Reference:', newFspReferenceNumber);

        // Update loan mapping with restructure info
        await LoanMapping.updateOne(
            { _id: loan._id },
            {
                $set: {
                    isRestructure: true,
                    restructureRequested: true,
                    restructureDate: new Date(),
                    restructureApplicationNumber: restructureData.applicationNumber, // Store new ApplicationNumber from UTUMISHI
                    newTenure: restructureData.tenure,
                    existingLoanAmount: requestedAmount,
                    currentOutstanding: requestedAmount,
                    newTotalAmountToPay: totalAmountToPay,
                    newInterestRate: 24.0,
                    newOtherCharges: otherCharges,
                    newLoanNumber: newLoanNumber,
                    newFspReferenceNumber: newFspReferenceNumber,
                    status: 'RESTRUCTURE_INITIAL_APPROVAL_SENT',
                    desiredDeductibleAmount: restructureData.desiredDeductibleAmount
                }
            }
        );

        console.log('\n✅ Updated loan mapping with restructure details');

        // Create the approval notification with correct ApplicationNumber
        const messageData = {
            Header: {
                "Sender": "ZE DONE",
                "Receiver": "ESS_UTUMISHI",
                "FSPCode": "FL8090",
                "MsgId": getMessageId("LOAN_INITIAL_APPROVAL_NOTIFICATION"),
                "MessageType": "LOAN_INITIAL_APPROVAL_NOTIFICATION"
            },
            MessageDetails: {
                "ApplicationNumber": restructureData.applicationNumber, // Use NEW ApplicationNumber from UTUMISHI
                "Reason": "Loan Restructure Request Approved",
                "FSPReferenceNumber": newFspReferenceNumber,
                "LoanNumber": newLoanNumber,
                "TotalAmountToPay": totalAmountToPay.toFixed(2),
                "OtherCharges": otherCharges.toFixed(2),
                "Approval": "APPROVED"
            }
        };

        console.log('\n📊 APPROVAL NOTIFICATION DETAILS:');
        console.log(JSON.stringify(messageData, null, 2));

        console.log('\n🔐 Generating signed XML...');
        const signedXml = digitalSignature.createSignedXML(messageData);

        console.log('✅ XML generated successfully');
        console.log('\n📄 XML PAYLOAD:');
        console.log('='.repeat(70));
        console.log(signedXml);
        console.log('='.repeat(70));

        console.log('\n📤 Sending to Utumishi...');
        console.log('URL: http://154.118.230.140:9802/ess-loans/mvtyztwq/consume');

        const callbackUrl = 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume';

        const response = await axios.post(callbackUrl, signedXml, {
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml'
            },
            timeout: 30000
        });

        console.log('\n✅ SUCCESS! LOAN_INITIAL_APPROVAL_NOTIFICATION sent');
        console.log('Status Code:', response.status);
        console.log('\n📥 UTUMISHI RESPONSE:');
        console.log('='.repeat(70));
        console.log(response.data);
        console.log('='.repeat(70));
        console.log('\n✅ RESTRUCTURE APPROVAL NOTIFICATION DELIVERED!');

        // Update loan mapping status
        await LoanMapping.updateOne(
            { _id: loan._id },
            {
                $set: {
                    initialApprovalSentAt: new Date()
                }
            }
        );

        await mongoose.disconnect();

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response Data:', error.response.data);
        }
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the function
updateAndSendCallback();
