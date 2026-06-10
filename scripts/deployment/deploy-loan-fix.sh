#!/bin/bash

echo "Deploying fixes for LOAN_FINAL_APPROVAL handler..."
echo "=================================================="
echo ""

# Copy fixed files to remote server
echo "1. Copying apiController.js to remote server..."
scp src/controllers/apiController.js uswege@135.181.33.13:/home/uswege/ess/src/controllers/

echo "2. Copying loanMappingService.js to remote server..."
scp src/services/loanMappingService.js uswege@135.181.33.13:/home/uswege/ess/src/services/

echo "3. Copying loan creation script..."
scp create-loan-for-ess1765974145523.js uswege@135.181.33.13:/home/uswege/ess/

echo ""
echo "4. Restarting PM2..."
ssh uswege@135.181.33.13 "cd /home/uswege/ess && pm2 restart ess-app"

echo ""
echo "5. Checking PM2 status..."
ssh uswege@135.181.33.13 "cd /home/uswege/ess && pm2 list"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To create the loan mapping and CBS loan, run:"
echo "ssh uswege@135.181.33.13 'cd /home/uswege/ess && node create-loan-for-ess1765974145523.js'"
