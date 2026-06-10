const xml2js = require('xml2js');
const digitalSignature = require('./src/utils/signatureUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');

// Loan liquidation data
const liquidationData = {
  applicationNumber: "ESS1766006882463",
  loanNumber: "LOAN1765996440393783",
  checkNumber: "11915366",
  fspReferenceNumber: "FSP_ESS1766006882463",
  firstName: "Akley",
  middleName: "Joseph",
  lastName: "Ntondo",
  fullName: "Akley Joseph Ntondo",
  principalOutstanding: 941407.13,
  liquidationAmount: 941407.13, // Principal outstanding only
  liquidationDate: new Date().toISOString().split('T')[0]
};

// Build the LOAN_LIQUIDATION_NOTIFICATION XML
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
    "CheckNumber": liquidationData.checkNumber,
    "FSPReferenceNumber": liquidationData.fspReferenceNumber,
    "FirstName": liquidationData.firstName,
    "MiddleName": liquidationData.middleName,
    "LastName": liquidationData.lastName,
    "LiquidationAmount": liquidationData.liquidationAmount.toFixed(2),
    "LiquidationDate": liquidationData.liquidationDate,
    "Reason": "Loan payoff for top-up"
  }
};

// Create signed XML
const signedXML = digitalSignature.createSignedXML(notificationData);

console.log('\n========================================');
console.log('LOAN_LIQUIDATION_NOTIFICATION XML');
console.log('========================================\n');
console.log(signedXML);
console.log('\n========================================');
console.log('NOTIFICATION DETAILS:');
console.log('========================================');
console.log('Application Number:', liquidationData.applicationNumber);
console.log('Loan Number:', liquidationData.loanNumber);
console.log('Client Name:', liquidationData.fullName);
console.log('Check Number:', liquidationData.checkNumber);
console.log('Liquidation Amount:', liquidationData.liquidationAmount.toFixed(2), 'TZS');
console.log('Liquidation Date:', liquidationData.liquidationDate);
console.log('========================================\n');

// Ask for confirmation before sending
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you want to send this notification to UTUMISHI? (yes/no): ', async (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    try {
      const { sendCallback } = require('./src/utils/callbackUtils');
      await sendCallback(notificationData);
      console.log('\n✅ LOAN_LIQUIDATION_NOTIFICATION sent successfully!');
    } catch (error) {
      console.error('\n❌ Error sending notification:', error.message);
    }
  } else {
    console.log('\n❌ Notification not sent.');
  }
  rl.close();
  process.exit(0);
});
