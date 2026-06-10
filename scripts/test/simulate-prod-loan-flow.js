const axios = require('axios');
const xml2js = require('xml2js');
const { v4: uuidv4 } = require('uuid');

const builder = new xml2js.Builder({
    rootName: 'Document',
    renderOpts: { pretty: true }
});

const API_URL = 'http://135.181.33.13:3002/api/loan';

// Common values for the flow
const applicationNumber = 'APP' + Date.now();
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
            RequestedAmount: loanAmount,
            RequestedTenure: tenure,
            ProductCode: "PERSONAL",
            CustomerIDNumber: "12345678",
            SalaryAmount: "450000"
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
            RequestedAmount: loanAmount,
            RequestedTenure: tenure,
            ProductCode: "PERSONAL",
            CustomerIDNumber: "12345678",
            SalaryAmount: "450000",
            FirstName: "John",
            LastName: "Doe",
            PhoneNumber: "254712345678",
            Email: "john.doe@example.com"
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
            LoanNumber: loanNumber || 'LOAN' + Date.now(),
            Approval: "APPROVED",
            ApprovalDate: new Date().toISOString().split('T')[0],
            CheckNumber: "CHK" + Math.floor(Math.random() * 1000000)
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
            timeout: 10000
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
        // 1. Send LOAN_CHARGES_REQUEST
        console.log('\n🚀 Starting loan application flow...');
        console.log(`Application Number: ${applicationNumber}`);
        console.log(`Loan Amount: ${loanAmount}`);
        console.log(`Tenure: ${tenure} months`);
        
        await sendRequest(createChargesRequest(), 1, 'LOAN_CHARGES_REQUEST');
        
        // Wait a bit before next request
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 2. Send LOAN_OFFER_REQUEST
        const offerResponse = await sendRequest(createLoanOfferRequest(), 2, 'LOAN_OFFER_REQUEST');
        
        // Extract loan number from offer response (if available)
        let loanNumber;
        try {
            const parsedResponse = await xml2js.parseStringPromise(offerResponse);
            loanNumber = parsedResponse?.Document?.Data?.MessageDetails?.LoanNumber;
        } catch (e) {
            loanNumber = 'LOAN' + Date.now();
        }
        
        // Wait a bit before next request
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. Send LOAN_FINAL_APPROVAL_NOTIFICATION
        await sendRequest(createFinalApprovalNotification(loanNumber), 3, 'LOAN_FINAL_APPROVAL_NOTIFICATION');
        
        console.log('\n✅ Loan flow simulation completed successfully!');
    } catch (error) {
        console.error('\n❌ Loan flow simulation failed:', error.message);
        process.exit(1);
    }
}

// Check if server is accessible
axios.get('http://135.181.33.13:3002/health')
    .then(() => {
        console.log('Server is accessible ✅');
        console.log('Starting loan flow simulation...');
        simulateLoanFlow();
    })
    .catch((error) => {
        console.error('Cannot access production server!');
        console.error('Error:', error.message);
        process.exit(1);
    });