#!/bin/bash

echo "Ì≥§ Sending LOAN_FINAL_APPROVAL_NOTIFICATION from Production Server"
echo "=" 

# Create the callback test script on production server
ssh miracore 'cat > /tmp/prod_final_approval.js << "SCRIPT_END"
const axios = require("axios");
const digitalSignature = require("./src/utils/signatureUtils");

async function sendFromProduction() {
    try {
        console.log("Ìø≠ PRODUCTION SERVER CALLBACK TEST");
        console.log("Working Directory:", process.cwd());
        
        const callbackData = {
            Data: {
                Header: {
                    Sender: "ZE DONE",
                    Receiver: "ESS_UTUMISHI", 
                    FSPCode: "FL8090",
                    MsgId: `PROD_FINAL_${Date.now()}`,
                    MessageType: "LOAN_FINAL_APPROVAL_NOTIFICATION"
                },
                MessageDetails: {
                    ApplicationNumber: "ESS1763982075940",
                    CheckNumber: "111276112",
                    Approval: "APPROVED", 
                    NIN: "19920615022541000173",
                    FirstName: "SIMBA",
                    MiddleName: "MAPUNDA", 
                    LastName: "NGUCHIRO",
                    MobileNo: "255714897308",
                    Sex: "M",
                    DateOfBirth: "1992-06-15",
                    EmploymentDate: "2020-08-01",
                    BankAccountNumber: "80100507609224",
                    SwiftCode: "CORUTZTZ",
                    ProductCode: "17",
                    Tenure: "24", 
                    InterestRate: "15.00",
                    ProcessingFee: "2.00",
                    Insurance: "1.00",
                    RequestedAmount: "15000000",
                    ApprovedAmount: "15000000",
                    MonthlyInstallment: "779166.67"
                }
            }
        };

        console.log("Ì≥ã Signing with PRODUCTION certificates...");
        const signedXML = digitalSignature.createSignedXML(callbackData.Data);
        
        const sigMatch = signedXML.match(/<Signature>(.*?)<\/Signature>/);
        if (sigMatch) {
            console.log("Ì¥è Production Signature (50 chars):", sigMatch[1].substring(0, 50) + "...");
        }

        console.log("Ìºê Sending from production to UTUMISHI...");
        const response = await axios.post("http://154.118.230.140:9802/ess-loans/mvtyztwq/consume", signedXML, {
            headers: {
                "Content-Type": "application/xml",
                "User-Agent": "ESS-Production/1.0"
            },
            timeout: 30000
        });

        console.log("‚úÖ PRODUCTION Response Status:", response.status);
        console.log("Ì≥• PRODUCTION Response:", response.data);
        
        const codeMatch = response.data.match(/<ResponseCode>(\\d+)<\/ResponseCode>/);
        if (codeMatch) {
            const code = codeMatch[1];
            console.log("Ìø∑Ô∏è  PRODUCTION ResponseCode:", code);
            
            switch(code) {
                case "8000":
                    console.log("Ìæâ PRODUCTION SUCCESS: Signature validation PASSED!");
                    break;
                case "8009": 
                    console.log("‚ùå PRODUCTION FAILURE: Signature validation failed");
                    break;
                case "8011":
                    console.log("‚ö†Ô∏è  PRODUCTION: Signature OK, business constraint");
                    break;
                default:
                    console.log("‚ÑπÔ∏è  PRODUCTION ResponseCode:", code);
            }
        }

    } catch (error) {
        console.error("‚ùå PRODUCTION Error:", error.message);
        if (error.response) {
            console.error("PRODUCTION Response Status:", error.response.status);
            console.error("PRODUCTION Response Data:", error.response.data);
        }
    }
}

sendFromProduction();
SCRIPT_END'

# Execute the script on production server
echo "Ì∫Ä Executing callback from production server..."
ssh miracore "cd /home/uswege/ess && node /tmp/prod_final_approval.js && rm /tmp/prod_final_approval.js"
