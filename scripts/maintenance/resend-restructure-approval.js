const mongoose = require('mongoose');
const axios = require('axios');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/signatureUtils');
require('dotenv').config();

/**
 * Re-send LOAN_INITIAL_APPROVAL_NOTIFICATION with correct ApplicationNumber
 * for loan restructure request
 */

const checkNumber = process.argv[2] || '11915366'; // From the LOAN_RESTRUCTURE_REQUEST log

console.log('📤 RE-SENDING LOAN_INITIAL_APPROVAL_NOTIFICATION FOR RESTRUCTURE');
console.log('='.repeat(70));
console.log('Check Number:', checkNumber);

async function resendRestructureApproval() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ess');
        const LoanMapping = require('./src/models/LoanMapping');
        
        // Find the loan by check number
        const loan = await LoanMapping.findOne({
            $or: [
                { checkNumber: checkNumber },
                { essCheckNumber: checkNumber }
            ]
        });

        if (!loan) {
            console.log('❌ Loan not found for check number:', checkNumber);
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log('✅ Found loan mapping');
        console.log('Application Number (original):', loan.applicationNumber);
        console.log('Application Number (restructure):', loan.restructureApplicationNumber);
        console.log('New Loan Number:', loan.newLoanNumber);
        console.log('New FSP Reference:', loan.newFspReferenceNumber);
        console.log('New Total Amount:', loan.newTotalAmountToPay);
        console.log('New Other Charges:', loan.newOtherCharges);

        // Verify we have restructure data
        if (!loan.restructureApplicationNumber) {
            console.log('⚠️ No restructure ApplicationNumber found. This loan may not have been restructured yet.');
            console.log('Original ApplicationNumber will be used:', loan.applicationNumber);
        }

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
                "ApplicationNumber": loan.restructureApplicationNumber || loan.applicationNumber || loan.essApplicationNumber,
                "Reason": "Loan Restructure Request Approved",
                "FSPReferenceNumber": loan.newFspReferenceNumber || loan.fspReferenceNumber,
                "LoanNumber": loan.newLoanNumber || loan.loanNumber,
                "TotalAmountToPay": (loan.newTotalAmountToPay || 0).toFixed(2),
                "OtherCharges": (loan.newOtherCharges || 0).toFixed(2),
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
                    status: 'RESTRUCTURE_INITIAL_APPROVAL_SENT',
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
resendRestructureApproval();
