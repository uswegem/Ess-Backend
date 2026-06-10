// Simple XML generator for LOAN_LIQUIDATION_NOTIFICATION
const xml2js = require('xml2js');

const liquidationData = {
  applicationNumber: "ESS1766006882463",
  loanNumber: "LOAN1765996440393783"
};

// Build the XML structure
const xmlData = {
  Document: {
    Data: {
      Header: {
        Sender: "ZE DONE",
        Receiver: "ESS_UTUMISHI",
        FSPCode: "FL8090",
        MsgId: `LOAN_LIQ_${Date.now()}`,
        MessageType: "LOAN_LIQUIDATION_NOTIFICATION"
      },
      MessageDetails: {
        ApplicationNumber: liquidationData.applicationNumber,
        LoanNumber: liquidationData.loanNumber,
        Remarks: "Loan finalized"
      }
    }
  }
};

// Create XML builder
const builder = new xml2js.Builder({
  rootName: 'Document',
  xmldec: { version: '1.0', encoding: 'UTF-8' },
  renderOpts: { pretty: true, indent: '    ' }
});

// Build XML (without root wrapper since we already have Document)
const xmlString = builder.buildObject(xmlData.Document);

console.log('\n' + '='.repeat(80));
console.log('LOAN_LIQUIDATION_NOTIFICATION XML');
console.log('='.repeat(80) + '\n');
console.log('<?xml version="1.0" encoding="UTF-8"?>');
console.log(xmlString);
console.log('\n' + '='.repeat(80));
console.log('DETAILS:');
console.log('='.repeat(80));
console.log('Application Number:', liquidationData.applicationNumber);
console.log('Loan Number:', liquidationData.loanNumber);
console.log('Remarks: Loan finalized');
console.log('='.repeat(80) + '\n');

console.log('\nNote: This XML needs to be signed before sending to UTUMISHI.');
console.log('The signature will be added when sent through the system.\n');
