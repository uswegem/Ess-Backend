const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const xml2js = require('xml2js');

const builder = new xml2js.Builder({
    rootName: 'Document',
    renderOpts: { pretty: false }
});

// Function to create a sample LOAN_FINAL_APPROVAL_NOTIFICATION
const createFinalApprovalNotification = () => {
    return {
        Document: {
            Data: {
                Header: {
                    Sender: "ESS_UTUMISHI",
                    Receiver: process.env.FSP_NAME || "ZE DONE",
                    FSPCode: process.env.FSP_CODE || "FL8090",
                    MsgId: `TEST_${uuidv4()}`,
                    MessageType: "LOAN_FINAL_APPROVAL_NOTIFICATION"
                },
                MessageDetails: {
                    LoanId: "LOAN" + Date.now(),
                    FSPLoanId: "FSP" + Date.now(),
                    LoanAmount: "5000000.00",
                    ApprovalStatus: "APPROVED",
                    Tenure: "24",
                    MonthlyInstallment: "250000.00",
                    ApprovalDate: new Date().toISOString().split('T')[0],
                    DisbursementDate: new Date().toISOString().split('T')[0],
                    ApplicationNumber: "APP" + Date.now(),
                    CheckNumber: "CHK" + Math.floor(Math.random() * 1000000),
                    FirstName: "John",
                    LastName: "Doe",
                    ProductCode: "PERSONAL"
                }
            }
        }
    };
};

// Function to send the notification
const sendFinalApprovalNotification = async () => {
    try {
        const notification = createFinalApprovalNotification();
        console.log('Sending notification:', JSON.stringify(notification, null, 2));

        // First check if the server is running
        try {
            await axios.get('http://localhost:3002/health');
            console.log('Server is running ✅');
        } catch (error) {
            console.error('Server is not running! Please start the server first.');
            console.error('To start the server, run: npm start');
            process.exit(1);
        }

        console.log('Sending request to http://localhost:3002/api/v1/process...');
        
        // Convert to XML
        const xmlData = builder.buildObject(notification);
        console.log('XML data:', xmlData);

        const response = await axios.post('http://localhost:3002/api/loan', xmlData, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 5000 // 5 second timeout
        });

        console.log('Response received ✅');
        console.log('Response Status:', response.status);
        console.log('Response Headers:', response.headers);
        console.log('Response Body:', response.data);
    } catch (error) {
        console.error('❌ Error sending notification:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Headers:', error.response.headers);
            console.error('Response Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received from server');
            console.error('Request details:', error.request);
        } else {
            console.error('Error setting up the request:', error.message);
        }
        process.exit(1);
    }
};

// Execute the simulation
sendFinalApprovalNotification();