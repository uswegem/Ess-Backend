#!/bin/bash

echo "============================================================"
echo "Creating Loan Mapping and CBS Loan for ESS1765974145523"
echo "============================================================"
echo ""
echo "This script will:"
echo "  1. Create loan mapping in MongoDB"
echo "  2. Create CBS client (or find existing)"
echo "  3. Create loan in CBS"
echo "  4. Approve the loan"
echo "  5. Disburse the loan"
echo "  6. Update loan mapping with CBS IDs"
echo ""
echo "Starting in 3 seconds..."
sleep 3

echo ""
echo "Executing on production server..."
echo ""

ssh miracore-prod 'cd /home/uswege/ess && node create-loan-for-ess1765974145523.js'

echo ""
echo "============================================================"
echo "Process Complete!"
echo "============================================================"
