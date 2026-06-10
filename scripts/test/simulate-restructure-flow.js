const digitalSignature = require('./src/utils/signatureUtils');
const { processRequest } = require('./src/controllers/apiController');
const cbsApi = require('./src/services/cbs.api');

async function simulateLoanRestructureFlow() {
    console.log('🚀 Simulating Loan Restructure Flow\n');

    try {
        // Step 1: LOAN_RESTRUCTURE_REQUEST
        console.log('📋 STEP 1: LOAN_RESTRUCTURE_REQUEST');
        console.log('--------------------------------------------------');
        const restructureRequest = {
            Document: {
                Data: {
                    Header: {
                        Sender: 'ESS_UTUMISHI',
                        Receiver: 'ZE DONE',
                        FSPCode: 'FL8090',
                        MsgId: `RESTRUCTURE_${Date.now()}`,
                        MessageType: 'LOAN_RESTRUCTURE_REQUEST'
                    },
                    MessageDetails: {
                        CheckNumber: 'CHK001',
                        LoanNumber: 'LOAN001',
                        FirstName: 'John',
                        LastName: 'Doe',
                        Sex: 'M',
                        EmploymentDate: '2020-01-01',
                        BankAccountNumber: '1234567890',
                        SwiftCode: 'TESTSWFT',
                        NIN: '1234567890123456',
                        BasicSalary: '1500000',
                        NetSalary: '1400000',
                        OneThirdAmount: '500000',
                        TotalEmployeeDeduction: '100000',
                        RetirementDate: '2050-01-01',
                        TermsOfEmployment: 'PERMANENT',
                        CurrentLoanBalance: '5000000',
                        AdditionalAmount: '1000000',
                        NewLoanAmount: '6000000',
                        ProductCode: '17',
                        InterestRate: '28',
                        ProcessingFee: '500',
                        Insurance: '200',
                        Tenure: '84'
                    }
                }
            }
        };

        // Sign and send restructure request
        console.log('\n📊 Using Request Data:');
        console.log('--------------------------------------------------');
        console.log('Current Loan Balance:', restructureRequest.Document.Data.MessageDetails.CurrentLoanBalance);
        console.log('Additional Amount:', restructureRequest.Document.Data.MessageDetails.AdditionalAmount);
        console.log('New Loan Amount:', restructureRequest.Document.Data.MessageDetails.NewLoanAmount);
        console.log('Client:', restructureRequest.Document.Data.MessageDetails.FirstName + ' ' + restructureRequest.Document.Data.MessageDetails.LastName);
        console.log('NIN:', restructureRequest.Document.Data.MessageDetails.NIN);
        console.log('Product Code:', restructureRequest.Document.Data.MessageDetails.ProductCode);

        // Sign the request
        const signedRestructureRequest = digitalSignature.createSignedXML(restructureRequest.Document.Data);
        console.log('\n📤 RESTRUCTURE REQUEST XML:');
        console.log(signedRestructureRequest);

        // Step 2: LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST
        console.log('\n📋 STEP 2: LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST');
        console.log('--------------------------------------------------');
        const affordabilityRequest = {
            Document: {
                Data: {
                    Header: {
                        Sender: 'ESS_UTUMISHI',
                        Receiver: 'ZE DONE',
                        FSPCode: 'FL8090',
                        MsgId: `RESTRUCTURE_AFF_${Date.now()}`,
                        MessageType: 'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST'
                    },
                    MessageDetails: {
                        CheckNumber: restructureRequest.Document.Data.MessageDetails.CheckNumber,
                        DesignationCode: 'DG001',
                        DesignationName: 'Senior Officer',
                        BasicSalary: '2500000',
                        NetSalary: '1800000',
                        OneThirdAmount: '833333',
                        RequestedAmount: restructureRequest.Document.Data.MessageDetails.NewLoanAmount,
                        DeductibleAmount: '600000',
                        DesiredDeductibleAmount: '500000',
                        RetirementDate: '2040-12-31',
                        TermsOfEmployment: 'Permanent',
                        Tenure: restructureRequest.Document.Data.MessageDetails.Tenure,
                        ProductCode: restructureRequest.Document.Data.MessageDetails.ProductCode,
                        VoteCode: 'V001',
                        TotalEmployeeDeduction: '200000',
                        JobClassCode: 'JC001',
                        LoanNumber: restructureRequest.Document.Data.MessageDetails.LoanNumber
                    }
                }
            }
        };

        // Sign the affordability request
        const signedAffordabilityRequest = digitalSignature.createSignedXML(affordabilityRequest.Document.Data);
        console.log('\n📤 AFFORDABILITY REQUEST XML:');
        console.log(signedAffordabilityRequest);

        console.log('\n📊 Affordability Request Details:');
        console.log('  Check Number:', affordabilityRequest.Document.Data.MessageDetails.CheckNumber);
        console.log('  Basic Salary:', affordabilityRequest.Document.Data.MessageDetails.BasicSalary);
        console.log('  Net Salary:', affordabilityRequest.Document.Data.MessageDetails.NetSalary);
        console.log('  Requested Amount:', affordabilityRequest.Document.Data.MessageDetails.RequestedAmount);
        console.log('  Desired Deductible:', affordabilityRequest.Document.Data.MessageDetails.DesiredDeductibleAmount);
        console.log('  Tenure:', affordabilityRequest.Document.Data.MessageDetails.Tenure, 'months');

        console.log('\n✅ Loan restructure simulation with affordability check completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during loan restructure flow:', error);
    }
}

// Run the simulation
simulateLoanRestructureFlow().catch(console.error);