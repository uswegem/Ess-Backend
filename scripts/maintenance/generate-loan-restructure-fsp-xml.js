/**
 * Generate LOAN_RESTRUCTURE_REQUEST_FSP XML structure for a specific loan
 * Complete structure based on API documentation
 */
function generateLoanRestructureRequestFSP(params) {
    // Generate a simple message ID
    const timestamp = Date.now();
    const msgId = `LRRF_${timestamp}`;

    const {
        applicationNumber,
        loanNumber,
        installmentAmount,
        outstandingBalance,
        principalBalance,
        validityDate,
        lastRepaymentDate,
        maturityDate,
        reason,
        newInstallmentAmount,
        newInsuranceAmount,
        newProcessingFee,
        newInterestAmount,
        newPrincipalAmount,
        newTotalAmountPayable,
        otherCharges,
        newTenure,
        productCode,
        deductionCode,
        fspReferenceNumber
    } = params;

    const messageData = {
        Data: {
            Header: {
                Sender: process.env.FSP_NAME || "ZE DONE",
                Receiver: "ESS_UTUMISHI",
                FSPCode: process.env.FSP_CODE || "FL8090",
                MsgId: msgId,
                MessageType: "LOAN_RESTRUCTURE_REQUEST_FSP"
            },
            MessageDetails: {
                ApplicationNumber: applicationNumber,
                LoanNumber: loanNumber,
                InstallmentAmount: installmentAmount.toFixed(2),
                OutstandingBalance: outstandingBalance.toFixed(2),
                PrincipalBalance: principalBalance.toFixed(2),
                ValidityDate: validityDate,
                LastRepaymentDate: lastRepaymentDate,
                MaturityDate: maturityDate,
                Reason: reason,
                NewInstallmentAmount: newInstallmentAmount.toFixed(2),
                NewInsuranceAmount: newInsuranceAmount.toFixed(2),
                NewProcessingFee: newProcessingFee.toFixed(2),
                NewInterestAmount: newInterestAmount.toFixed(2),
                NewPrincipalAmount: newPrincipalAmount.toFixed(2),
                NewTotalAmountPayable: newTotalAmountPayable.toFixed(2),
                OtherCharges: otherCharges.toFixed(2),
                NewTenure: newTenure.toString(),
                ProductCode: productCode,
                DeductionCode: deductionCode,
                FSPReferenceNumber: fspReferenceNumber
            }
        }
    };

    // Generate complete XML structure (without signature for now)
    const xmlStructure = `<Document>
  <Data>
    <Header>
      <Sender>${messageData.Data.Header.Sender}</Sender>
      <Receiver>${messageData.Data.Header.Receiver}</Receiver>
      <FSPCode>${messageData.Data.Header.FSPCode}</FSPCode>
      <MsgId>${messageData.Data.Header.MsgId}</MsgId>
      <MessageType>${messageData.Data.Header.MessageType}</MessageType>
    </Header>
    <MessageDetails>
      <ApplicationNumber>${messageData.Data.MessageDetails.ApplicationNumber}</ApplicationNumber>
      <LoanNumber>${messageData.Data.MessageDetails.LoanNumber}</LoanNumber>
      <InstallmentAmount>${messageData.Data.MessageDetails.InstallmentAmount}</InstallmentAmount>
      <OutstandingBalance>${messageData.Data.MessageDetails.OutstandingBalance}</OutstandingBalance>
      <PrincipalBalance>${messageData.Data.MessageDetails.PrincipalBalance}</PrincipalBalance>
      <ValidityDate>${messageData.Data.MessageDetails.ValidityDate}</ValidityDate>
      <LastRepaymentDate>${messageData.Data.MessageDetails.LastRepaymentDate}</LastRepaymentDate>
      <MaturityDate>${messageData.Data.MessageDetails.MaturityDate}</MaturityDate>
      <Reason>${messageData.Data.MessageDetails.Reason}</Reason>
      <NewInstallmentAmount>${messageData.Data.MessageDetails.NewInstallmentAmount}</NewInstallmentAmount>
      <NewInsuranceAmount>${messageData.Data.MessageDetails.NewInsuranceAmount}</NewInsuranceAmount>
      <NewProcessingFee>${messageData.Data.MessageDetails.NewProcessingFee}</NewProcessingFee>
      <NewInterestAmount>${messageData.Data.MessageDetails.NewInterestAmount}</NewInterestAmount>
      <NewPrincipalAmount>${messageData.Data.MessageDetails.NewPrincipalAmount}</NewPrincipalAmount>
      <NewTotalAmountPayable>${messageData.Data.MessageDetails.NewTotalAmountPayable}</NewTotalAmountPayable>
      <OtherCharges>${messageData.Data.MessageDetails.OtherCharges}</OtherCharges>
      <NewTenure>${messageData.Data.MessageDetails.NewTenure}</NewTenure>
      <ProductCode>${messageData.Data.MessageDetails.ProductCode}</ProductCode>
      <DeductionCode>${messageData.Data.MessageDetails.DeductionCode}</DeductionCode>
      <FSPReferenceNumber>${messageData.Data.MessageDetails.FSPReferenceNumber}</FSPReferenceNumber>
    </MessageDetails>
  </Data>
  <Signature>{{SIGNATURE_PLACEHOLDER}}</Signature>
</Document>`;

    return {
        messageData,
        xmlStructure
    };
}

// Generate XML for the specific loan with sample data
const { messageData, xmlStructure } = generateLoanRestructureRequestFSP({
    applicationNumber: "APP1766054808065",
    loanNumber: "LOAN1766054808065",
    installmentAmount: 150000.00, // Current monthly installment
    outstandingBalance: 1800000.00, // Current total outstanding
    principalBalance: 1500000.00, // Current principal remaining
    validityDate: "2025-12-19T10:00:00",
    lastRepaymentDate: "2025-12-01T00:00:00",
    maturityDate: "2026-12-19T00:00:00",
    reason: "Extended tenure request",
    newInstallmentAmount: 125000.00, // Proposed new monthly installment
    newInsuranceAmount: 50000.00,
    newProcessingFee: 30000.00,
    newInterestAmount: 360000.00, // New interest for extended tenure
    newPrincipalAmount: 1500000.00, // Same principal
    newTotalAmountPayable: 1940000.00, // Principal + interest + charges
    otherCharges: 0.00,
    newTenure: 18, // Extended from 12 to 18 months
    productCode: "SALARY_LOAN",
    deductionCode: "DED001",
    fspReferenceNumber: "FSP1766054808065"
});

console.log("=== LOAN_RESTRUCTURE_REQUEST_FSP XML Structure ===");
console.log("\n=== Message Data (JSON) ===");
console.log(JSON.stringify(messageData, null, 2));
console.log("\n=== XML Structure (before signing) ===");
console.log(xmlStructure);
console.log("\n=== Summary ===");
console.log(`Current Monthly Installment: ${messageData.Data.MessageDetails.InstallmentAmount}`);
console.log(`New Monthly Installment: ${messageData.Data.MessageDetails.NewInstallmentAmount}`);
console.log(`Current Tenure: 12 months (assumed)`);
console.log(`New Tenure: ${messageData.Data.MessageDetails.NewTenure} months`);