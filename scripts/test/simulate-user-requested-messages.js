const axios = require('axios');

async function simulateRequestedMessages() {
    console.log('🚀 Simulating Requested Message Types (XML Request/Response Demo)\n');
    console.log('='.repeat(80) + '\n');

    // 1. TOP_UP_PAY_0FF_BALANCE_REQUEST
    console.log('📋 1. TOP_UP_PAY_0FF_BALANCE_REQUEST');
    console.log('-'.repeat(60));

    const topUpPayOffRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TOPUP_PAYOFF_TEST_${Date.now()}</MsgId>
            <MessageType>TOP_UP_PAY_0FF_BALANCE_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <FirstName>John</FirstName>
            <LastName>Doe</LastName>
            <NIN>12345678901234567890</NIN>
            <BankAccountNumber>123456789</BankAccountNumber>
            <SwiftCode>TANZ1234</SwiftCode>
            <LoanNumber>LOAN123456</LoanNumber>
            <TopUpAmount>2000000</TopUpAmount>
            <TopUpTenure>12</TopUpTenure>
            <TopUpInterestRate>25.0</TopUpInterestRate>
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(topUpPayOffRequest);

    // Mock response for TOP_UP_PAY_0FF_BALANCE_REQUEST
    const topUpPayOffResponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TOPUP_PAYOFF_RESP_${Date.now()}</MsgId>
            <MessageType>LOAN_TOP_UP_BALANCE_RESPONSE</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <LoanNumber>LOAN123456</LoanNumber>
            <BalanceAmount>1500000.00</BalanceAmount>
            <Currency>TZS</Currency>
            <ResponseCode>00</ResponseCode>
            <ResponseDescription>Success</ResponseDescription>
            <TransactionReference>TXN${Date.now()}</TransactionReference>
        </MessageDetails>
    </Data>
    <Signature>MockSignatureHere</Signature>
</Document>`;

    console.log('\n📥 RESPONSE XML:');
    console.log(topUpPayOffResponse);

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

    // 3. TOP_UP_OFFER_REQUEST
    console.log('📋 3. TOP_UP_OFFER_REQUEST');
    console.log('-'.repeat(60));

    const topUpOfferRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TOPUP_OFFER_TEST_${Date.now()}</MsgId>
            <MessageType>TOP_UP_OFFER_REQUEST</MessageType>
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
            <ExistingLoanBalance>1500000</ExistingLoanBalance>
            <TopUpAmount>2000000</TopUpAmount>
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
            <LoanPurpose>Top-up for Education</LoanPurpose>
            <SwiftCode>TANZ1234</SwiftCode>
            <Funding>Self</Funding>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(topUpOfferRequest);

    // Mock response for TOP_UP_OFFER_REQUEST
    const topUpOfferResponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TOPUP_OFFER_RESP_${Date.now()}</MsgId>
            <MessageType>LOAN_INITIAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <FSPReferenceNumber>FSP${Date.now()}</FSPReferenceNumber>
            <LoanNumber>202510222232338</LoanNumber>
            <Approval>APPROVED</Approval>
            <ApprovedAmount>2000000</ApprovedAmount>
            <Tenure>12</Tenure>
            <InterestRate>25.0</InterestRate>
            <MonthlyInstallment>187500</MonthlyInstallment>
            <ProcessingFee>10000</ProcessingFee>
            <Insurance>5000</Insurance>
            <TotalAmountPayable>2350000</TotalAmountPayable>
            <ExistingLoanBalance>1500000</ExistingLoanBalance>
            <TotalPayOffAmount>3500000</TotalPayOffAmount>
            <ResponseCode>0000</ResponseCode>
            <Description>Top-up loan application approved with generated loan alias</Description>
        </MessageDetails>
    </Data>
    <Signature>MockSignatureHere</Signature>
</Document>`;

    console.log('\n📥 RESPONSE XML:');
    console.log(topUpOfferResponse);

    console.log('\n' + '='.repeat(80) + '\n');

    // 4. LOAN_FINAL_APPROVAL_NOTIFICATION
    console.log('📋 4. LOAN_FINAL_APPROVAL_NOTIFICATION');
    console.log('-'.repeat(60));

    const finalApprovalRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>FINAL_APPROVAL_TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
            <FSPReferenceNumber>FSP${Date.now()}</FSPReferenceNumber>
            <LoanNumber>LOAN${Date.now()}</LoanNumber>
            <Approval>APPROVED</Approval>
            <NIN>1234567890123456</NIN>
            <FirstName>John</FirstName>
            <LastName>Doe</LastName>
            <MobileNo>0712345678</MobileNo>
            <Sex>M</Sex>
            <DateOfBirth>1990-01-01</DateOfBirth>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <BankAccountNumber>1234567890</BankAccountNumber>
            <SwiftCode>TESTSWFT</SwiftCode>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <RequestedAmount>5000000</RequestedAmount>
            <ProductCode>17</ProductCode>
            <Tenure>24</Tenure>
            <InterestRate>28</InterestRate>
            <ProcessingFee>500</ProcessingFee>
            <Insurance>200</Insurance>
        </MessageDetails>
    </Data>
</Document>`;

    console.log('📤 REQUEST XML:');
    console.log(finalApprovalRequest);

    // Mock response for LOAN_FINAL_APPROVAL_NOTIFICATION
    const finalApprovalResponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document>
    <Data>
        <Header>
            <Sender>ZE DONE</Sender>
            <Receiver>ESS_UTUMISHI</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>FINAL_RESP_${Date.now()}</MsgId>
            <MessageType>LOAN_DISBURSEMENT_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>APP${Date.now()}</ApplicationNumber>
            <FSPReferenceNumber>FSP${Date.now()}</FSPReferenceNumber>
            <LoanNumber>202510222232337</LoanNumber>
            <ClientId>12345</ClientId>
            <LoanId>67890</LoanId>
            <LoanAccountNumber>000123456789</LoanAccountNumber>
            <DisbursementAmount>5000000</DisbursementAmount>
            <DisbursementDate>${new Date().toISOString().split('T')[0]}</DisbursementDate>
            <BankAccountNumber>1234567890</BankAccountNumber>
            <SwiftCode>TESTSWFT</SwiftCode>
            <ResponseCode>0000</ResponseCode>
            <Description>Loan disbursed successfully. Client created and loan account activated.</Description>
        </MessageDetails>
    </Data>
    <Signature>MockSignatureHere</Signature>
</Document>`;

    console.log('\n📥 RESPONSE XML:');
    console.log(finalApprovalResponse);

    console.log('\n' + '='.repeat(80) + '\n');
    console.log('✅ Requested message types simulation completed!\n');
    console.log('📋 SUMMARY:');
    console.log('1. TOP_UP_PAY_0FF_BALANCE_REQUEST → Calculates top-up pay-off balance');
    console.log('2. LOAN_CHARGES_REQUEST → Calculates loan charges and fees');
    console.log('3. TOP_UP_OFFER_REQUEST → Processes top-up loan application');
    console.log('4. LOAN_FINAL_APPROVAL_NOTIFICATION → Triggers disbursement notification (no RESPONSE sent)');
}

simulateRequestedMessages().catch(console.error);