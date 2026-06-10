#!/bin/bash

echo "====================================="
echo "Deployment Status Check"
echo "====================================="
echo ""

echo "1. Checking PM2 status..."
ssh miracore-prod "pm2 list" 2>&1 | head -15

echo ""
echo "2. Checking recent logs..."
ssh miracore-prod "pm2 logs ess-app --lines 10 --nostream" 2>&1 | tail -20

echo ""
echo "3. Creating loan mapping and CBS loan for ESS1765974145523..."
echo "   This may take 30-60 seconds..."
ssh miracore-prod "cd /home/uswege/ess && timeout 60 node create-loan-for-ess1765974145523.js" 2>&1

echo ""
echo "====================================="
echo "Deployment check complete!"
echo "====================================="
