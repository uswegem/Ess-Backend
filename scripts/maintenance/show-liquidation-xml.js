require('dotenv').config();
const digitalSignature = require('./src/utils/signatureUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');

// Loan liquidation data for LOAN1765996440393783
const liquidationData = {
  applicationNumber: "ESS1766006882463",
  loanNumber: "LOAN1765996440393783",
  checkNumber: "11915366",
  fspReferenceNumber: "FSP_ESS1766006882463",
  firstName: "Akley",
  middleName: "Joseph",
  lastName: "Ntondo",
  principalOutstanding: 941407.13,
  liquidationAmount: 941407.13, // Principal outstanding only
  liquidationDate: new Date().toISOString().split('T')[0]
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

// Create signed XML
const signedXML = digitalSignature.createSignedXML(notificationData);

console.log('\n' + '='.repeat(80));
console.log('LOAN_LIQUIDATION_NOTIFICATION XML FOR LOAN1765996440393783');
console.log('='.repeat(80) + '\n');
console.log(signedXML);
console.log('\n' + '='.repeat(80));
console.log('NOTIFICATION SUMMARY:');
console.log('='.repeat(80));
console.log('Application Number:', liquidationData.applicationNumber);
console.log('Loan Number:', liquidationData.loanNumber);
console.log('Client Name:', liquidationData.firstName, liquidationData.middleName, liquidationData.lastName);
console.log('Check Number:', liquidationData.checkNumber);
console.log('Liquidation Amount:', liquidationData.liquidationAmount.toFixed(2), 'TZS');
console.log('Liquidation Date:', liquidationData.liquidationDate);
console.log('Reason: Loan payoff for top-up');
console.log('='.repeat(80) + '\n');
