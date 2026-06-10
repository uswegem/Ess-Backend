const signatureUtils = require('./src/utils/signatureUtils');
const thirdPartyService = require('./src/services/thirdPartyService');

async function buildSignedMessage(messageObj) {
  const signed = await signatureUtils.createSignedXML(messageObj);
  return signed;
}

function baseHeader(messageType) {
  return {
    Sender: 'ZE DONE',
    Receiver: 'ESS_UTUMISHI',
    FSPCode: 'FL8090',
    MsgId: `ESS${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
    MessageType: messageType
  };
}

async function run() {
  try {
    // 1) LOAN_CHARGES_REQUEST
    console.log('\n=== LOAN_CHARGES_REQUEST ===');
    const charges = {
      Header: baseHeader('LOAN_CHARGES_REQUEST'),
      MessageDetails: {
        ApplicationNumber: 'APP123',
        FSPReferenceNumber: 'FSP123',
        LoanAmount: 5000,
        CustomerId: 'CUS123',
        CustomerName: 'John Doe',
        LoanProduct: 'Personal Loan',
        LoanTenure: 12,
        InterestRate: 15,
        CustomerType: 'EMPLOYEE'
      }
    };

    const signedCharges = await buildSignedMessage(charges);
    console.log('\n-- REQUEST XML (LOAN_CHARGES_REQUEST) --\n');
    console.log(signedCharges);

    try {
      const resp1 = await thirdPartyService.forwardToThirdParty(signedCharges, 'LOAN_CHARGES_REQUEST');
      console.log('\n-- RESPONSE (LOAN_CHARGES_REQUEST) --\n');
      console.log(resp1 || '<no body>');
    } catch (err) {
      console.log('\n-- SEND ERROR (LOAN_CHARGES_REQUEST) --\n');
      console.log(err.message || err);
    }

    // 2) LOAN_OFFER_REQUEST
    console.log('\n=== LOAN_OFFER_REQUEST ===');
    const offer = {
      Header: baseHeader('LOAN_OFFER_REQUEST'),
      MessageDetails: {
        ApplicationNumber: 'APP123',
        FSPReferenceNumber: 'FSP123',
        LoanAmount: 5000,
        CustomerId: 'CUS123',
        CustomerName: 'John Doe',
        LoanProduct: 'Personal Loan',
        LoanTenure: 12,
        InterestRate: 15,
        ProcessingFee: 100,
        InsuranceFee: 50,
        TotalCharges: 150,
        MonthlyRepayment: 458.33,
        CustomerType: 'EMPLOYEE',
        AcceptedTerms: true
      }
    };

    const signedOffer = await buildSignedMessage(offer);
    console.log('\n-- REQUEST XML (LOAN_OFFER_REQUEST) --\n');
    console.log(signedOffer);

    try {
      const resp2 = await thirdPartyService.forwardToThirdParty(signedOffer, 'LOAN_OFFER_REQUEST');
      console.log('\n-- RESPONSE (LOAN_OFFER_REQUEST) --\n');
      console.log(resp2 || '<no body>');
    } catch (err) {
      console.log('\n-- SEND ERROR (LOAN_OFFER_REQUEST) --\n');
      console.log(err.message || err);
    }

    // 3) LOAN_FINAL_APPROVAL_NOTIFICATION
    console.log('\n=== LOAN_FINAL_APPROVAL_NOTIFICATION ===');
    const final = {
      Header: baseHeader('LOAN_FINAL_APPROVAL_NOTIFICATION'),
      MessageDetails: {
        ApplicationNumber: 'APP123',
        FSPReferenceNumber: 'FSP123',
        LoanNumber: 'LOAN123',
        Approval: true,
        Reason: 'All checks passed',
        CustomerId: 'CUS123',
        CustomerName: 'John Doe',
        LoanAmount: 5000,
        LoanTenure: 12,
        InterestRate: 15
      }
    };

    const signedFinal = await buildSignedMessage(final);
    console.log('\n-- REQUEST XML (LOAN_FINAL_APPROVAL_NOTIFICATION) --\n');
    console.log(signedFinal);

    try {
      const resp3 = await thirdPartyService.forwardToThirdParty(signedFinal, 'LOAN_FINAL_APPROVAL_NOTIFICATION');
      console.log('\n-- RESPONSE (LOAN_FINAL_APPROVAL_NOTIFICATION) --\n');
      console.log(resp3 || '<no body>');
    } catch (err) {
      console.log('\n-- SEND ERROR (LOAN_FINAL_APPROVAL_NOTIFICATION) --\n');
      console.log(err.message || err);
    }

  } catch (e) {
    console.error('Unexpected error in run:', e);
  }
}

run();
