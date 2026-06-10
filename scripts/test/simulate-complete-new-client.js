const axios = require('axios');
const xml2js = require('xml2js');
const { v4: uuidv4 } = require('uuid');

const builder = new xml2js.Builder({
    rootName: 'Document',
    renderOpts: { pretty: true }
});

const API_URL = 'http://135.181.33.13:3002/api/loan';

// Generate unique identifiers for a new client
const applicationNumber = 'APP' + Date.now();
const checkNumber = 'CHK' + Date.now();
const nin = '35724198' + Date.now().toString().slice(-4); // Unique NIN
const uniqueEmail = `john.doe.${Date.now()}@example.com`;

// Common values
const loanAmount = 5000000;
const tenure = 24;

// 1. LOAN_CHARGES_REQUEST
const createChargesRequest = () => ({
    Data: {
        Header: {
            Sender: "ESS_UTUMISHI",
            Receiver: "ZE DONE",
            FSPCode: "FL8090",
            MsgId: `TEST_${uuidv4()}`,
            MessageType: "LOAN_CHARGES_REQUEST"
        },
        MessageDetails: {
            ApplicationNumber: applicationNumber,
            CheckNumber: checkNumber,
            DesignationCode: "D001",
            DesignationName: "Senior Teacher",
            BasicSalary: "1500000",
            NetSalary: "1200000",
            OneThirdAmount: "500000",
            DeductibleAmount: "100000",
            RetirementDate: "2050-01-01",
            TermsOfEmployment: "PERMANENT",
            RequestedAmount: loanAmount,
            DesiredDeductibleAmount: "150000",
            Tenure: tenure,
            ProductCode: "17",
            VoteCode: "V001",
            TotalEmployeeDeduction: "100000",
            JobClassCode: "J001"
        }
    }
});

// 2. LOAN_OFFER_REQUEST
const createLoanOfferRequest = () => ({
    Data: {
        Header: {
            Sender: "ESS_UTUMISHI",
            Receiver: "ZE DONE",
            FSPCode: "FL8090",
            MsgId: `TEST_${uuidv4()}`,
            MessageType: "LOAN_OFFER_REQUEST"
        },
        MessageDetails: {
            ApplicationNumber: applicationNumber,
            CheckNumber: checkNumber,
            FirstName: "John",
            MiddleName: "William",
            LastName: "Doe",
            Sex: "M",
            DateOfBirth: "1990-01-01",
            EmploymentDate: "2020-01-01",
            BankAccountNumber: "1234567890",
            SwiftCode: "TESTSWFT",
            NIN: nin,
            BasicSalary: "1500000",
            NetSalary: "1200000",
            OneThirdAmount: "500000",
            TotalEmployeeDeduction: "100000",
            RetirementDate: "2050-01-01",
            TermsOfEmployment: "PERMANENT",
            RequestedAmount: loanAmount,
            ProductCode: "17",
            Tenure: tenure,
            Email: uniqueEmail,
            PhoneNumber: "255712345678",
            MaritalStatus: "Single"
        }
    }
});

// 3. LOAN_FINAL_APPROVAL_NOTIFICATION
const createFinalApprovalNotification = (loanNumber) => ({
    Data: {
        Header: {
            Sender: "ESS_UTUMISHI",
            Receiver: "ZE DONE",
            FSPCode: "FL8090",
            MsgId: `TEST_${uuidv4()}`,
            MessageType: "LOAN_FINAL_APPROVAL_NOTIFICATION"
        },
        MessageDetails: {
            ApplicationNumber: applicationNumber,
            FSPReferenceNumber: loanNumber || `FSP${Date.now()}`,
            LoanNumber: loanNumber || `LOAN${Date.now()}`,
            Approval: "APPROVED",
            NIN: nin,
            FirstName: "John",
            MiddleName: "William",
            LastName: "Doe",
            MobileNo: "255712345678",
            Sex: "M",
            DateOfBirth: "1990-01-01",
            EmploymentDate: "2020-01-01",
            BankAccountNumber: "1234567890",
            SwiftCode: "TESTSWFT",
            CheckNumber: checkNumber,
            RequestedAmount: loanAmount,
            ProductCode: "17",
            Tenure: tenure,
            InterestRate: "28",
            ProcessingFee: "500",
            Insurance: "200",
            ApprovalDate: new Date().toISOString().split('T')[0]
        }
    }
});

// Function to send request and log XML
async function sendRequest(data, stepNumber, description) {
    console.log(`\n=== Step ${stepNumber}: ${description} ===`);
    
    const xmlData = builder.buildObject(data);
    console.log('\nRequest XML:');
    console.log(xmlData);

    try {
        const response = await axios.post(API_URL, xmlData, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 30000
        });

        console.log('\nResponse XML:');
        console.log(response.data);
        
        return response.data;
    } catch (error) {
        console.error(`Error in step ${stepNumber}:`, error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        throw error;
    }
}

// Main function to run the simulation
async function simulateLoanFlow() {
    try {
        // Print simulation info
        console.log('\n🚀 Starting new client loan application flow...');
        console.log('Test Client Details:');
        console.log(`Application Number: ${applicationNumber}`);
        console.log(`Check Number: ${checkNumber}`);
        console.log(`NIN: ${nin}`);
        console.log(`Email: ${uniqueEmail}`);
        console.log(`Loan Amount: ${loanAmount}`);
        console.log(`Tenure: ${tenure} months`);
        console.log('='.repeat(80));
        
        // 1. Send LOAN_CHARGES_REQUEST
        await sendRequest(createChargesRequest(), 1, 'LOAN_CHARGES_REQUEST');
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 2. Send LOAN_OFFER_REQUEST
        const offerResponse = await sendRequest(createLoanOfferRequest(), 2, 'LOAN_OFFER_REQUEST');
        
        // Parse loan number from offer response if available
        let loanNumber;
        try {
            const parsedResponse = await xml2js.parseStringPromise(offerResponse);
            loanNumber = parsedResponse?.Document?.Data?.MessageDetails?.LoanNumber;
        } catch (e) {
            loanNumber = 'LOAN' + Date.now();
        }
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. Send LOAN_FINAL_APPROVAL_NOTIFICATION
        await sendRequest(createFinalApprovalNotification(loanNumber), 3, 'LOAN_FINAL_APPROVAL_NOTIFICATION');
        
        console.log('\n✅ Loan flow simulation completed successfully!');
        console.log('\nNext steps:');
        console.log('1. A new client should have been created');
        console.log('2. A new loan account should have been created');
        console.log('3. Loan approval should be recorded');
        console.log('4. Manual disbursement is required');
        console.log('5. After disbursement, a webhook will trigger LOAN_DISBURSEMENT_NOTIFICATION');
        
    } catch (error) {
        console.error('\n❌ Loan flow simulation failed:', error.message);
        process.exit(1);
    }
}

// Check if server is accessible before starting
axios.get('http://135.181.33.13:3002/health')
    .then(() => {
        console.log('Server is accessible ✅');
        console.log('Starting loan flow simulation...');
        simulateLoanFlow();
    })
    .catch((error) => {
        console.error('Cannot access server!');
        console.error('Error:', error.message);
        process.exit(1);
    });