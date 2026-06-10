require('dotenv').config();
const digitalSignature = require('./src/utils/signatureUtils');
const { sendCallback } = require('./src/utils/callbackUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');

const liquidationData = {
  applicationNumber: "ESS1766006882463",
  loanNumber: "LOAN1765996440393783"
};

// Build the LOAN_LIQUIDATION_NOTIFICATION
const notificationData = {
  Header: {
    "Sender": process.env.FSP_NAME || "ZE DONE",
    "Receiver": "ESS_UTUMISHI",
    "FSPCode": process.env.FSP_CODE || "FL8090",
    "MsgId": getMessageId("LOAN_LIQUIDATION_NOTIFICATION"),
    "MessageType": "LOAN_LIQUIDATION_NOTIFICATION"
  },
  MessageDetails: {
    "ApplicationNumber": liquidationData.applicationNumber,
    "LoanNumber": liquidationData.loanNumber,
    "Remarks": "Loan finalized"
  }
};

console.log('\n' + '='.repeat(80));
console.log('SENDING LOAN_LIQUIDATION_NOTIFICATION');
console.log('='.repeat(80));
console.log('Application Number:', liquidationData.applicationNumber);
console.log('Loan Number:', liquidationData.loanNumber);
console.log('Remarks: Loan finalized');
console.log('='.repeat(80) + '\n');

// Sign the XML
console.log('🔐 Signing XML...');
const signedXML = digitalSignature.createSignedXML(notificationData);
console.log('✅ XML signed successfully\n');

console.log('📤 Sending to UTUMISHI...\n');

// Send the callback
sendCallback(notificationData)
  .then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('✅ SUCCESS!');
    console.log('='.repeat(80));
    console.log('LOAN_LIQUIDATION_NOTIFICATION sent successfully to UTUMISHI');
    console.log('Application:', liquidationData.applicationNumber);
    console.log('Loan Number:', liquidationData.loanNumber);
    console.log('='.repeat(80) + '\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n' + '='.repeat(80));
    console.error('❌ ERROR SENDING NOTIFICATION');
    console.error('='.repeat(80));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80) + '\n');
    process.exit(1);
  });
