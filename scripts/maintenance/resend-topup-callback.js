#!/usr/bin/env node

/**
 * Manual script to resend TOP_UP_OFFER_REQUEST callback with the fixed generateFSPReferenceNumber function
 * This script simulates the delayed callback that should be sent after a TOP_UP_OFFER_REQUEST
 */

const axios = require('axios');
const { generateLoanNumber, generateFSPReferenceNumber } = require('./src/utils/loanUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const digitalSignature = require('./src/utils/digitalSignature');
const LOAN_CONSTANTS = require('./src/utils/loanConstants');

// Configuration
const CALLBACK_URL = process.env.THIRD_PARTY_BASE_URL || 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume';
const FSP_NAME = process.env.FSP_NAME || 'ZE DONE';

async function sendTopUpCallback() {
    try {
        console.log('🔄 Sending TOP_UP_OFFER_REQUEST callback with fixed generateFSPReferenceNumber...');

        // Sample TOP_UP_OFFER_REQUEST data (adjust as needed)
        const sampleTopUpData = {
            applicationNumber: `APP_TOPUP_${Date.now()}`,
            checkNumber: `CHK_TOPUP_${Date.now()}`,
            existingLoanNumber: `LOAN1764618377`, // Use existing loan from logs
            additionalAmount: 2000000, // 2M as in logs
            newTenure: 30
        };

        // Calculate loan details
        const loanAmount = parseFloat(sampleTopUpData.additionalAmount) || LOAN_CONSTANTS.MIN_LOAN_AMOUNT;
        const interestRate = 15.0; // 15% per annum
        const tenure = parseInt(sampleTopUpData.newTenure) || LOAN_CONSTANTS.MAX_TENURE;

        // Calculate total amount to pay
        const totalInterestRateAmount = (loanAmount * interestRate * tenure) / (12 * 100);
        const totalAmountToPay = loanAmount + totalInterestRateAmount;
        const otherCharges = LOAN_CONSTANTS?.OTHER_CHARGES || 50000;
        
        // Generate new loan number and FSP reference (using fixed function)
        const loanNumber = generateLoanNumber();
        const fspReferenceNumber = generateFSPReferenceNumber(); // This is now fixed!

        console.log(`📊 Calculated Details:`);
        console.log(`   - Loan Amount: ${loanAmount.toLocaleString()}`);
        console.log(`   - Interest Rate: ${interestRate}% per annum`);
        console.log(`   - Tenure: ${tenure} months`);
        console.log(`   - Total Amount to Pay: ${totalAmountToPay.toLocaleString()}`);
        console.log(`   - Other Charges: ${otherCharges.toLocaleString()}`);
        console.log(`   - Loan Number: ${loanNumber}`);
        console.log(`   - FSP Reference: ${fspReferenceNumber}`);

        // Build LOAN_INITIAL_APPROVAL_NOTIFICATION response
        const approvalResponseData = {
            Header: {
                "Sender": FSP_NAME,
                "Receiver": "ESS_UTUMISHI",
                "FSPCode": "FL8090",
                "MsgId": getMessageId("LOAN_INITIAL_APPROVAL_NOTIFICATION"),
                "MessageType": "LOAN_INITIAL_APPROVAL_NOTIFICATION"
            },
            MessageDetails: {
                "ApplicationNumber": sampleTopUpData.applicationNumber,
                "Reason": "Top-Up Loan Request Approved",
                "FSPReferenceNumber": fspReferenceNumber, // Using the fixed function!
                "LoanNumber": loanNumber,
                "TotalAmountToPay": totalAmountToPay.toFixed(2),
                "OtherCharges": otherCharges.toFixed(2),
                "Approval": "APPROVED"
            }
        };

        console.log(`\n📤 Callback Data:`);
        console.log(JSON.stringify(approvalResponseData, null, 2));

        // Create signed XML
        const signedXml = digitalSignature.createSignedXML(approvalResponseData);
        
        console.log(`\n📋 Signed XML Preview:`);
        console.log(signedXml.substring(0, 500) + '...');

        // Send callback
        console.log(`\n🚀 Sending callback to: ${CALLBACK_URL}`);
        
        const response = await axios.post(CALLBACK_URL, signedXml, {
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml'
            },
            timeout: 30000
        });

        console.log(`✅ Callback sent successfully!`);
        console.log(`📊 Response Status: ${response.status}`);
        console.log(`📄 Response Data:`, response.data);

    } catch (error) {
        console.error('❌ Error sending TOP_UP_OFFER_REQUEST callback:', error.message);
        if (error.response) {
            console.error(`📊 Response Status: ${error.response.status}`);
            console.error(`📄 Response Data:`, error.response.data);
        }
    }
}

// Execute the callback
console.log('🎯 Starting TOP_UP_OFFER_REQUEST Callback Resend...');
console.log(`🌐 Target URL: ${CALLBACK_URL}`);
console.log(`🏢 FSP Name: ${FSP_NAME}`);
console.log('─'.repeat(60));

sendTopUpCallback()
    .then(() => {
        console.log('\n🏁 Callback resend process completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    });