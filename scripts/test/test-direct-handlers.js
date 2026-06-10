const xml2js = require('xml2js');
const { LoanCalculate } = require('./src/services/loanService');
const digitalSignature = require('./src/utils/signatureUtils');
const LOAN_CONSTANTS = require('./src/utils/loanConstants');

const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    normalize: true,
    trim: true
});

async function testLoanMessageTypesDirect() {
    console.log('🚀 Testing Loan API Message Types (Direct Handler Calls)\n');
    console.log('='.repeat(60) + '\n');

    // Mock response object
    const mockRes = {
        set: function(header, value) { this.headers = this.headers || {}; this.headers[header] = value; },
        send: function(data) { this.responseData = data; console.log(data); }
    };

    // Test 1: LOAN_CHARGES_REQUEST
    console.log('📋 TEST 1: LOAN_CHARGES_REQUEST');
    console.log('-'.repeat(40));

    const loanChargesRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>LOAN_CONSTANTS.EXTERNAL_SYSTEM</Sender>
            <Receiver>LOAN_CONSTANTS.FSP_NAME</Receiver>
            <FSPCode>LOAN_CONSTANTS.FSP_CODE</FSPCode>
            <MsgId>CHARGES_TEST_001</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK001</CheckNumber>
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
    console.log('\n📥 RESPONSE XML:');

    try {
        const parsedData = await parser.parseStringPromise(loanChargesRequest);

        // Extract message details from XML
        const messageDetails = parsedData.Document.Data.MessageDetails;

        // Convert XML data to format expected by LoanCalculate
        const loanData = {
            checkNumber: messageDetails.CheckNumber,
            designationCode: messageDetails.DesignationCode,
            designationName: messageDetails.DesignationName,
            basicSalary: parseFloat(messageDetails.BasicSalary),
            netSalary: parseFloat(messageDetails.NetSalary),
            oneThirdAmount: parseFloat(messageDetails.OneThirdAmount),
            deductibleAmount: parseFloat(messageDetails.DeductibleAmount),
            retirementDate: messageDetails.RetirementDate,
            termsOfEmployment: messageDetails.TermsOfEmployment,
            requestedAmount: messageDetails.RequestedAmount ? parseFloat(messageDetails.RequestedAmount) : null,
            desiredDeductibleAmount: messageDetails.DesiredDeductibleAmount ? parseFloat(messageDetails.DesiredDeductibleAmount) : null,
            tenure: messageDetails.Tenure ? parseInt(messageDetails.Tenure) : null,
            fspCode: parsedData.Document.Data.Header.FSPCode,
            productCode: messageDetails.ProductCode,
            voteCode: messageDetails.VoteCode,
            totalEmployeeDeduction: parseFloat(messageDetails.TotalEmployeeDeduction),
            jobClassCode: messageDetails.JobClassCode
        };

        console.log('Extracted loan data:', loanData);

        // Call loan service directly
        const result = await LoanCalculate(loanData);

        // Convert result to ESS response format
        const responseData = {
            Data: {
                Header: {
                    Sender: process.env.FSP_NAME || "ZE DONE",
                    Receiver: "ESS_UTUMISHI",
                    FSPCode: parsedData.Document.Data.Header.FSPCode,
                    MsgId: `RESP_${Date.now()}`,
                    MessageType: "LOAN_CHARGES_RESPONSE"
                },
                MessageDetails: {
                    DesiredDeductibleAmount: result.desiredDeductibleAmount || "0.00",
                    TotalInsurance: result.totalInsurance || "0.00",
                    TotalProcessingFees: result.totalProcessingFees || "0.00",
                    TotalInterestRateAmount: result.totalInterestRateAmount || "0.00",
                    OtherCharges: "0.00",
                    NetLoanAmount: result.netLoanAmount || "0.00",
                    TotalAmountToPay: result.totalAmountToPay || "0.00",
                    Tenure: result.tenure?.toString() || "0",
                    EligibleAmount: result.eligibleAmount || "0.00",
                    MonthlyReturnAmount: result.monthlyReturnAmount || "0.00"
                }
            }
        };

        // Generate signed XML response
        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        console.log(signedResponse);

    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: LOAN_OFFER_REQUEST
    console.log('📋 TEST 2: LOAN_OFFER_REQUEST');
    console.log('-'.repeat(40));

    const loanOfferRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>OFFER_TEST_001</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK001</CheckNumber>
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
    console.log(loanOfferRequest);
    console.log('\n📥 RESPONSE XML:');

    try {
        const parsedData = await parser.parseStringPromise(loanOfferRequest);

        const messageDetails = parsedData.Document.Data.MessageDetails;

        // Extract all loan offer data
        const loanOfferData = {
            checkNumber: messageDetails.CheckNumber,
            designationCode: messageDetails.DesignationCode,
            designationName: messageDetails.DesignationName,
            basicSalary: parseFloat(messageDetails.BasicSalary),
            netSalary: parseFloat(messageDetails.NetSalary),
            oneThirdAmount: parseFloat(messageDetails.OneThirdAmount),
            totalEmployeeDeduction: parseFloat(messageDetails.TotalEmployeeDeduction),
            retirementDate: messageDetails.RetirementDate,
            termsOfEmployment: messageDetails.TermsOfEmployment,
            requestedAmount: parseFloat(messageDetails.RequestedAmount),
            desiredDeductibleAmount: parseFloat(messageDetails.DesiredDeductibleAmount),
            tenure: parseInt(messageDetails.Tenure),
            fspCode: parsedData.Document.Data.Header.FSPCode,
            productCode: messageDetails.ProductCode
        };

        console.log('Processing loan offer:', loanOfferData);

        // Return immediate approval notification
        const responseData = {
            Data: {
                Header: {
                    Sender: process.env.FSP_NAME || "ZE DONE",
                    Receiver: "ESS_UTUMISHI",
                    FSPCode: parsedData.Document.Data.Header.FSPCode,
                    MsgId: `OFFER_${Date.now()}`,
                    MessageType: "LOAN_INITIAL_APPROVAL_NOTIFICATION"
                },
                MessageDetails: {
                    ApplicationNumber: loanOfferData.checkNumber,
                    Reason: "Loan offer received successfully",
                    FSPReferenceNumber: `FSPREF${Date.now()}`,
                    LoanNumber: `LN${Date.now()}`,
                    TotalAmountToPay: "0.00",
                    OtherCharges: "0.00",
                    Approval: "APPROVED"
                }
            }
        };

        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        console.log(signedResponse);

    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 3: LOAN_FINAL_APPROVAL_NOTIFICATION
    console.log('📋 TEST 3: LOAN_FINAL_APPROVAL_NOTIFICATION');
    console.log('-'.repeat(40));

    const finalApprovalRequest = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>FINAL_APPROVAL_TEST_001</MsgId>
            <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>APP001</ApplicationNumber>
            <FSPReferenceNumber>FSP001</FSPReferenceNumber>
            <LoanNumber>LOAN001</LoanNumber>
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
            <CheckNumber>CHK001</CheckNumber>
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
    console.log('\n📥 RESPONSE XML:');

    try {
        const parsedData = await parser.parseStringPromise(finalApprovalRequest);

        const messageDetails = parsedData.Document.Data.MessageDetails;

        // Extract approval data
        const approvalData = {
            applicationNumber: messageDetails.ApplicationNumber,
            fspReferenceNumber: messageDetails.FSPReferenceNumber,
            loanNumber: messageDetails.LoanNumber,
            approval: messageDetails.Approval,
            nin: messageDetails.NIN,
            firstName: messageDetails.FirstName,
            lastName: messageDetails.LastName,
            mobileNo: messageDetails.MobileNo,
            sex: messageDetails.Sex,
            dateOfBirth: messageDetails.DateOfBirth,
            employmentDate: messageDetails.EmploymentDate,
            bankAccountNumber: messageDetails.BankAccountNumber,
            swiftCode: messageDetails.SwiftCode,
            checkNumber: messageDetails.CheckNumber,
            requestedAmount: messageDetails.RequestedAmount,
            productCode: messageDetails.ProductCode,
            tenure: messageDetails.Tenure,
            interestRate: messageDetails.InterestRate,
            processingFee: messageDetails.ProcessingFee,
            insurance: messageDetails.Insurance
        };

        console.log('Final approval data:', approvalData);

        // No immediate response for LOAN_FINAL_APPROVAL_NOTIFICATION
        // Processing continues asynchronously
        console.log('✅ LOAN_FINAL_APPROVAL_NOTIFICATION processing started - no immediate response required');
        console.log('ℹ️ Manual disbursement will trigger LOAN_DISBURSEMENT_NOTIFICATION later');

        const signedResponse = digitalSignature.createSignedXML(responseData.Data);
        console.log(signedResponse);

    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
}

testLoanMessageTypesDirect().catch(console.error);