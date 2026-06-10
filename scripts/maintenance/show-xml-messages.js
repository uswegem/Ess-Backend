// Display the XML messages for ESS1765974145523

const sentXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
  <Data>
    <Header>
      <Sender>ZE DONE</Sender>
      <Receiver>ESS_UTUMISHI</Receiver>
      <FSPCode>FL8090</FSPCode>
      <MsgId>LDFN_ZD25121717050512</MsgId>
      <MessageType>LOAN_DISBURSEMENT_FAILURE_NOTIFICATION</MessageType>
    </Header>
    <MessageDetails>
      <ApplicationNumber>ESS1765974145523</ApplicationNumber>
      <Reason>CBS integration pending - Client and loan creation in progress</Reason>
    </MessageDetails>
  </Data>
  <Signature>[Digital Signature - 344 bytes]</Signature>
</Document>`;

const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
  <Data>
    <Header>
      <Sender>ESS_UTUMISHI</Sender>
      <Receiver>ZE DONE</Receiver>
      <FSPCode>FL8090</FSPCode>
      <MsgId>4b8885c5db6a11f08d6597678a3cbcd4</MsgId>
      <MessageType>RESPONSE</MessageType>
    </Header>
    <MessageDetails>
      <ResponseCode>8000</ResponseCode>
      <Description>LOAN_DISBURSEMENT_FAILURE_NOTIFICATION Received Successfully</Description>
    </MessageDetails>
  </Data>
  <Signature>lyXETts+5jZ5ICxhmnFXZPNiolORU17eu8DCGcczEF7CnmyZRE+pdE16CrlzkQvZvt6IOiYEONPnYW7hTbkp3LX8gb8Fywm1rwv+qkZlm2k2PuyAJuU+tS1yBliV9N44eJ+7gWeaFnqIptGOgfpYec3FidxardijDO99EvdC8RwEj2IybPRdA91mHt5vA6xMYX3QJrwmJLlKBjdgdXD3oq8t8PF9vIiM5ouPOCBHXbUXjkHf9xeh0wrXa8W4cYt2HNH1PoGcp2AHscv0HOlTesVcH1u+6pda4snQ6/29XqnQSyRlrx2AK/xdZdDJfmWndpfruqQvA0c/022Yz6ktmQ==</Signature>
</Document>`;

console.log('\n📤 LOAN_DISBURSEMENT_FAILURE_NOTIFICATION SENT TO UTUMISHI');
console.log('='.repeat(80));
console.log(sentXML);

console.log('\n');
console.log('📥 RESPONSE FROM UTUMISHI');
console.log('='.repeat(80));
console.log(responseXML);

console.log('\n');
console.log('✅ Status: SUCCESS');
console.log('   Response Code: 8000');
console.log('   Description: LOAN_DISBURSEMENT_FAILURE_NOTIFICATION Received Successfully');
console.log('   Application: ESS1765974145523');
console.log('   Timestamp: 2025-12-17 17:05:46 EAT');
