#!/bin/bash
# Fix LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST handler to correctly use LoanCalculate response

cd /home/uswege/ess

# Backup
cp src/controllers/apiController.js src/controllers/apiController.js.backup_$(date +%Y%m%d_%H%M%S)

cat > /tmp/fix_handler.txt << 'EOF'
        };

        // Use existing loan calculator for restructure affordability
        const calculationData = await LoanCalculate(requestParams);

        // Prepare the response data structure
        const responseData = {
            Data: {
                Header: {
                    "Sender": process.env.FSP_NAME || "ZE DONE",
                    "Receiver": "ESS_UTUMISHI",
                    "FSPCode": header.FSPCode,
                    "MsgId": getMessageId("LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE"),
                    "MessageType": "LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE"
                },
                MessageDetails: {
                    "DesiredDeductibleAmount": calculationData.desiredDeductibleAmount || requestParams.desiredDeductibleAmount.toFixed(2),
                    "TotalInsurance": calculationData.totalInsurance || "0.00",
                    "TotalProcessingFees": calculationData.totalProcessingFees || "0.00",
                    "TotalInterestRateAmount": calculationData.totalInterestRateAmount || "0.00",
                    "OtherCharges": calculationData.otherCharges || "0.00",
                    "NetLoanAmount": calculationData.netLoanAmount || requestParams.requestedAmount.toFixed(2),
                    "TotalAmountToPay": calculationData.totalAmountToPay || "0.00",
                    "Tenure": calculationData.tenure?.toString() || requestParams.tenure.toString(),
                    "EligibleAmount": calculationData.eligibleAmount || "0.00",
                    "MonthlyReturnAmount": calculationData.monthlyReturnAmount || "0.00"
                }
            }
        };

        logger.info('✅ Loan restructure affordability calculated:', {
            checkNumber: requestParams.checkNumber,
EOF

# Replace lines 1408-1440 with the fixed version
sed -i '1408,1440d' src/controllers/apiController.js
sed -i '1407r /tmp/fix_handler.txt' src/controllers/apiController.js

echo "✅ Fix applied!"
echo ""
echo "Verifying the changes..."
sed -n '1408,1435p' src/controllers/apiController.js

rm /tmp/fix_handler.txt
