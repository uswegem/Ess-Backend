const axios = require('axios');

async function simulateTakeoverMessages() {
    console.log('🚀 Simulating Takeover Message Types (XML Request/Response Demo)\n');
    console.log('='.repeat(80) + '\n');

    // 1. TAKEOVER_PAY_OFF_BALANCE_REQUEST
    console.log('📋 1. TAKEOVER_PAY_OFF_BALANCE_REQUEST');
    console.log('-'.repeat(60));

    const takeoverPayOffRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TAKEOVER_PAYOFF_TEST_${Date.now()}</MsgId>
            <MessageType>TAKEOVER_PAY_OFF_BALANCE_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <LoanNumber>LOAN123456</LoanNumber>
            <FirstName>John</FirstName>
            <MiddleName></MiddleName>
            <LastName>Doe</LastName>
            <VoteCode>V001</VoteCode>
            <VoteName>Education Vote</VoteName>
            <DeductionAmount>150000</DeductionAmount>
            <DeductionCode>D001</DeductionCode>
            <DeductionName>Loan Deduction</DeductionName>
            <DeductionBalance>1200000</DeductionBalance>
            <PaymentOption>FULL_PAYOFF</PaymentOption>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(takeoverPayOffRequest);

    // Mock response for TAKEOVER_PAY_OFF_BALANCE_REQUEST
    const takeoverPayOffResponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TAKEOVER_BAL_RESP_${Date.now()}</MsgId>
            <MessageType>LOAN_TAKEOVER_BALANCE_RESPONSE</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <LoanNumber>LOAN123456</LoanNumber>
            <BalanceAmount>1200000.00</BalanceAmount>
            <Currency>TZS</Currency>
            <ResponseCode>00</ResponseCode>
            <ResponseDescription>Success</ResponseDescription>
            <TransactionReference>TXN${Date.now()}</TransactionReference>
        </MessageDetails>
    </Data>
    <Signature>MockSignatureHere</Signature>
</Document>`;

    console.log('\n📥 RESPONSE XML:');
    console.log(takeoverPayOffResponse);

    console.log('\n' + '='.repeat(80) + '\n');

    // 2. LOAN_CHARGES_REQUEST
    console.log('📋 2. LOAN_CHARGES_REQUEST');
    console.log('-'.repeat(60));

    const loanChargesRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>CHARGES_TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <DesignationCode>D001</DesignationCode>
            <DesignationName>Teacher</DesignationName>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1400000</NetSalary>
            <OneThirdAmount>500000</OneThirdAmount>
            <DeductibleAmount>100000</DeductibleAmount>
            <RetirementDate>2050-01-01</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
            <RequestedAmount>5000000</RequestedAmount>
            <DesiredDeductibleAmount>150000</DesiredDeductibleAmount>
            <Tenure>24</Tenure>
            <ProductCode>17</ProductCode>
            <VoteCode>V001</VoteCode>
            <TotalEmployeeDeduction>100000</TotalEmployeeDeduction>
            <JobClassCode>J001</JobClassCode>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(loanChargesRequest);

    // Mock response for LOAN_CHARGES_REQUEST
    const loanChargesResponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>CHARGES_RESP_${Date.now()}</MsgId>
            <MessageType>LOAN_CHARGES_RESPONSE</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <RequestedAmount>5000000</RequestedAmount>
            <Tenure>24</Tenure>
            <ProductCode>17</ProductCode>
            <InterestRate>28.0</InterestRate>
            <MonthlyInstallment>245833</MonthlyInstallment>
            <TotalInterest>900000</TotalInterest>
            <TotalAmountPayable>5900000</TotalAmountPayable>
            <ProcessingFee>5000</ProcessingFee>
            <Insurance>2500</Insurance>
            <Charges>
                <Charge>
                    <Name>Processing Fee</Name>
                    <Amount>5000</Amount>
                    <Type>FIXED</Type>
                </Charge>
                <Charge>
                    <Name>Insurance</Name>
                    <Amount>2500</Amount>
                    <Type>FIXED</Type>
                </Charge>
            </Charges>
            <ResponseCode>0000</ResponseCode>
            <Description>Loan charges calculated successfully</Description>
        </MessageDetails>
    </Data>
    <Signature>MockSignatureHere</Signature>
</Document>`;

    console.log('\n📥 RESPONSE XML:');
    console.log(loanChargesResponse);

    console.log('\n' + '='.repeat(80) + '\n');

    // 3. LOAN_TAKEOVER_OFFER_REQUEST
    console.log('📋 3. LOAN_TAKEOVER_OFFER_REQUEST');
    console.log('-'.repeat(60));

    const takeoverOfferRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TAKEOVER_OFFER_TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_TAKEOVER_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <FirstName>John</FirstName>
            <MiddleName></MiddleName>
            <LastName>Doe</LastName>
            <Sex>M</Sex>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <MaritalStatus>Single</MaritalStatus>
            <BankAccountNumber>123456789</BankAccountNumber>
            <VoteCode>V001</VoteCode>
            <VoteName>Education Vote</VoteName>
            <NIN>12345678901234567890</NIN>
            <DesignationCode>D001</DesignationCode>
            <DesignationName>Teacher</DesignationName>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1400000</NetSalary>
            <OneThirdAmount>500000</OneThirdAmount>
            <TotalEmployeeDeduction>100000</TotalEmployeeDeduction>
            <RetirementDate>2050-01-01</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
            <ExistingLoanNumber>LOAN123456</ExistingLoanNumber>
            <RequestedTakeoverAmount>2000000</RequestedTakeoverAmount>
            <DesiredDeductibleAmount>200000</DesiredDeductibleAmount>
            <Tenure>12</Tenure>
            <FSPCode>FL8090</FSPCode>
            <ProductCode>17</ProductCode>
            <InterestRate>25.0</InterestRate>
            <ProcessingFee>10000</ProcessingFee>
            <Insurance>5000</Insurance>
            <PhysicalAddress>123 Main Street, Dar es Salaam</PhysicalAddress>
            <EmailAddress>john.doe@example.com</EmailAddress>
            <MobileNumber>0712345678</MobileNumber>
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
            <LoanPurpose>Takeover for Education</LoanPurpose>
            <SwiftCode>TANZ1234</SwiftCode>
            <Funding>Self</Funding>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(takeoverOfferRequest);

    // Mock response for LOAN_TAKEOVER_OFFER_REQUEST
    const takeoverOfferResponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TAKEOVER_OFFER_RESP_${Date.now()}</MsgId>
            <MessageType>LOAN_TAKEOVER_OFFER_RESPONSE</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <FSPReferenceNumber>FSP${Date.now()}</FSPReferenceNumber>
            <LoanNumber>202510222232339</LoanNumber>
            <Approval>APPROVED</Approval>
            <OfferedTakeoverAmount>2000000</OfferedTakeoverAmount>
            <Tenure>12</Tenure>
            <InterestRate>25.0</InterestRate>
            <MonthlyInstallment>187500</MonthlyInstallment>
            <ProcessingFee>10000</ProcessingFee>
            <Insurance>5000</Insurance>
            <TotalAmountPayable>2350000</TotalAmountPayable>
            <ExistingLoanBalance>1200000</ExistingLoanBalance>
            <TotalPayOffAmount>3200000</TotalPayOffAmount>
            <ResponseCode>0000</ResponseCode>
            <Description>Takeover loan application approved with generated loan alias</Description>
        </MessageDetails>
    </Data>
    <Signature>MockSignatureHere</Signature>
</Document>`;

    console.log('\n📥 RESPONSE XML:');
    console.log(takeoverOfferResponse);

    console.log('\n' + '='.repeat(80) + '\n');

    // 4. TAKEOVER_PAYMENT_NOTIFICATION
    console.log('📋 4. TAKEOVER_PAYMENT_NOTIFICATION');
    console.log('-'.repeat(60));

    const takeoverPaymentRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TAKEOVER_PAYMENT_TEST_${Date.now()}</MsgId>
            <MessageType>TAKEOVER_PAYMENT_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
            <FSPReferenceNumber>FSP${Date.now()}</FSPReferenceNumber>
            <LoanNumber>LOAN${Date.now()}</LoanNumber>
            <ClientId>12346</ClientId>
            <LoanId>67891</LoanId>
            <LoanAccountNumber>000123456790</LoanAccountNumber>
            <DisbursementAmount>2000000</DisbursementAmount>
            <DisbursementDate>${new Date().toISOString().split('T')[0]}</DisbursementDate>
            <BankAccountNumber>1234567890</BankAccountNumber>
            <SwiftCode>TESTSWFT</SwiftCode>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <RequestedAmount>2000000</RequestedAmount>
            <ProductCode>17</ProductCode>
            <Tenure>12</Tenure>
            <InterestRate>25</InterestRate>
            <ProcessingFee>10000</ProcessingFee>
            <Insurance>5000</Insurance>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(takeoverPaymentRequest);

    // For notifications, no response is sent back
    console.log('\n📥 RESPONSE: No response sent for notifications (processed successfully)');

    console.log('\n' + '='.repeat(80) + '\n');
    console.log('✅ Requested takeover message types simulation completed!\n');
    console.log('📋 SUMMARY:');
    console.log('1. TAKEOVER_PAY_OFF_BALANCE_REQUEST → Calculates takeover pay-off balance');
    console.log('2. LOAN_CHARGES_REQUEST → Calculates loan charges and fees');
    console.log('3. LOAN_TAKEOVER_OFFER_REQUEST → Processes takeover loan application');
    console.log('4. TAKEOVER_PAYMENT_NOTIFICATION → Triggers takeover payment processing (no RESPONSE sent)');
}

simulateTakeoverMessages().catch(console.error);