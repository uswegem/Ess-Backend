#!/bin/bash

echo "🚀 Manual ESS Backend Deployment with Admin Routes"
echo "================================================"

# Production server details
SERVER="135.181.33.13"
USER="uswege"
PATH="/home/uswege/ess"

echo ""
echo "📋 Deployment Steps:"
echo "1. SSH to production server: ssh $USER@$SERVER"
echo "2. Navigate to ESS directory: cd $PATH"
echo "3. Pull latest changes: git pull origin main"
echo "4. Install dependencies: npm install"
echo "5. Restart PM2: pm2 restart all"
echo "6. Check status: pm2 status"
echo ""
echo "🔧 Admin API Routes will be available at:"
echo "   http://$SERVER:3002/api/v1/auth/login"
echo "   http://$SERVER:3002/api/v1/loan/list-products"
echo "   http://$SERVER:3002/api/v1/loan/list-employee-loan"
echo ""
echo "📱 Frontend Configuration Needed:"
echo "   API_BASE_URL: http://$SERVER:3002/api/v1"
echo ""
echo "Run these commands manually on the production server:"
echo "ssh $USER@$SERVER"