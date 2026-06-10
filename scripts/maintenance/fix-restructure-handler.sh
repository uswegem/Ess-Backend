#!/bin/bash
# Fix LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST handler
# The issue: Handler expects { success, data } but LoanCalculate returns the data directly

cd /home/uswege/ess

# Backup the file
cp src/controllers/apiController.js src/controllers/apiController.js.backup_$(date +%Y%m%d_%H%M%S)

# Create the fix using sed
sed -i '1410,1418s/const affordabilityResult = await LoanCalculate(requestParams);.*if (!affordabilityResult.success) {.*throw new Error.*}.*const calculationData = affordabilityResult.data;/const calculationData = await LoanCalculate(requestParams);/' src/controllers/apiController.js

echo "Fix applied. Checking the changes..."
sed -n '1410,1420p' src/controllers/apiController.js
