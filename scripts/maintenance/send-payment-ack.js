const mongoose = require('mongoose');
const digitalSignature = require('./src/utils/signatureUtils');
const { getMessageId } = require('./src/utils/messageIdGenerator');
const { sendCallback } = require('./src/utils/callbackUtils');
const logger = require('./src/utils/logger');
require('dotenv').config();

async function sendAcknowledgment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const LoanMapping = require('./src/models/LoanMapping');

    const loanMapping = await LoanMapping.findOne({ essLoanNumberAlias: 'LOAN1766137041163588' });

    if (!loanMapping) {
      console.log('❌ Loan mapping not found');
      await mongoose.disconnect();
      return;
    }

    console.log('✅ Found loan mapping:', {
      applicationNumber: loanMapping.essApplicationNumber,
      loanNumber: loanMapping.essLoanNumberAlias,
      fspReferenceNumber: loanMapping.fspReferenceNumber,
      mifosLoanId: loanMapping.mifosLoanId
    });

    const notificationData = {
      Data: {
        Header: {
          "Sender": process.env.FSP_NAME || "ZE DONE",
          "Receiver": "ESS_UTUMISHI",
          "FSPCode": process.env.FSP_CODE || "FL8090",
          "MsgId": getMessageId("PAYMENT_ACKNOWLEDGMENT_NOTIFICATION"),
          "MessageType": "PAYMENT_ACKNOWLEDGMENT_NOTIFICATION"
        },
        MessageDetails: {
          "ApplicationNumber": "ESS1766228800490",
          "Remarks": "settled",
          "FSPReferenceNumber": loanMapping.fspReferenceNumber,
          "LoanNumber": "LOAN1766137041163588",
          "PaymentStatus": "SETTLED"
        }
      }
    };

    console.log('📤 Sending PAYMENT_ACKNOWLEDGMENT_NOTIFICATION...');
    console.log(JSON.stringify(notificationData, null, 2));

    const callbackResponse = await sendCallback(notificationData);

    console.log('✅ Callback response:', callbackResponse);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

sendAcknowledgment();
