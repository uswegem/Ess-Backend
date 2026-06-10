const digitalSignature = require('./src/utils/signatureUtils');
const axios = require('axios');

// Server configuration - Remote server
const SERVER_URL = 'http://135.181.33.13:3002/api/loan';

async function testLoanOffer() {
    console.log('🧪 Testing LOAN_OFFER_REQUEST with loan mapping creation\n');

    try {
        // Generate unique application number
        const applicationNumber = `ESS${Date.now()}`;
        const checkNumber = `CHK${Date.now()}`;

        console.log('📝 Test Data:');
        console.log(`  Application Number: ${applicationNumber}`);
        console.log(`  Check Number: ${checkNumber}\n`);

        // Create LOAN_OFFER_REQUEST
        const offerRequest = {
            Document: {
                Data: {
                    Header: {
                        Sender: 'ESS_UTUMISHI',
                        Receiver: 'ZE DONE',
                        FSPCode: 'FL8090',
                        MsgId: `OFFER_${Date.now()}`,
                        MessageType: 'LOAN_OFFER_REQUEST'
                    },
                    MessageDetails: {
                        ApplicationNumber: applicationNumber,
                        CheckNumber: checkNumber,
                        FirstName: 'Pelagia',
                        MiddleName: 'Test',
                        LastName: 'Mureithi',
                        Sex: 'F',
                        NIN: '19901231-12345-12345-67',
                        BankAccountNumber: '1234567890',
                        EmploymentDate: '2020-01-01',
                        MaritalStatus: 'Single',
                        ConfirmationDate: '2020-06-01',
                        PhysicalAddress: '123 Test Street, Nairobi',
                        EmailAddress: 'pelagia.test@example.com',
                        MobileNumber: '0712345678',
                        SwiftCode: 'TESTSWFT',
                        DesignationCode: 'ENG001',
                        DesignationName: 'Engineer',
                        BasicSalary: '2000000',
                        NetSalary: '1600000',
                        OneThirdAmount: '530000',
                        TotalEmployeeDeduction: '400000',
                        RetirementDate: '2050-01-01',
                        TermsOfEmployment: 'PERMANENT',
                        VoteCode: 'V001',
                        VoteName: 'Ministry of Test',
                        NearestBranchName: 'Nairobi Branch',
                        NearestBranchCode: 'NRB001',
                        RequestedAmount: '5000000',
                        DesiredDeductibleAmount: '500000',
                        DeductibleAmount: '530000',
                        Tenure: '60',
                        ProductCode: '17',
                        InterestRate: '15',
                        ProcessingFee: '0',
                        Insurance: '0',
                        LoanPurpose: 'Personal',
                        ContractStartDate: '2024-12-17',
                        ContractEndDate: '2029-12-17',
                        Funding: 'INTERNAL'
                    }
                }
            }
        };

        // Sign and send request
        console.log('📤 Sending LOAN_OFFER_REQUEST...\n');
        const signedRequest = digitalSignature.createSignedXML(offerRequest.Document.Data);
        
        const response = await axios({
            method: 'post',
            url: SERVER_URL,
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml',
                'User-Agent': 'Miracore-Backend/1.0'
            },
            data: signedRequest,
            timeout: 10000,
            validateStatus: () => true // Accept any status code
        });

        console.log('✅ Server Response:', response.status);
        console.log('Response Data:', response.data, '\n');

        console.log('✅ Request sent successfully!');
        console.log('📊 Check server logs to verify loan mapping was created.');
        console.log('   You can query MongoDB manually with:');
        console.log(`   db.loanmappings.findOne({essApplicationNumber: "${applicationNumber}"})\n`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Server response:', error.response.status, error.response.data);
        }
    }
}

// Run the test
testLoanOffer().catch(console.error);
