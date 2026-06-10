#!/bin/bash
# Fix production server logger issue and restart

echo "Connecting to production server..."
ssh uswege@135.181.33.13 << 'ENDSSH'
cd ~/ess
echo "Pulling latest code..."
git pull origin main
echo "Stopping PM2..."
pm2 stop ess-app
echo "Clearing PM2 logs..."
pm2 flush ess-app
echo "Starting PM2..."
pm2 start ess-app --update-env
echo "Checking status..."
pm2 status
echo "Checking logs..."
pm2 logs ess-app --lines 20 --nostream
ENDSSH
echo "Done!"
