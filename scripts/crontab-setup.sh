#!/bin/bash

# Cron Job Setup for IPSec and Connectivity Monitoring
# Add these entries to your crontab with: crontab -e

# Monitor IPSec tunnel every 5 minutes
*/5 * * * * /home/uswege/ess/scripts/ipsec-monitor.sh

# Monitor application connectivity every 2 minutes  
*/2 * * * * /usr/bin/node /home/uswege/ess/scripts/connectivity-monitor.js check

# Daily connectivity report at 6 AM
0 6 * * * /usr/bin/node /home/uswege/ess/scripts/connectivity-monitor.js status >> /home/uswege/ess/logs/daily-connectivity-report.log

# Clean old logs weekly (keep last 30 days)
0 2 * * 0 find /home/uswege/ess/logs -name "*.log" -mtime +30 -delete

# Restart keep-alive service daily at 3 AM to prevent memory leaks
0 3 * * * pm2 restart ess-keep-alive

# Monitor disk space (important for log files)
0 */6 * * * df -h /home/uswege/ess | awk 'NR==2{if($5+0 > 80) print "Disk usage warning: "$5 " used"}' | mail -s "Disk Space Alert" admin@yourdomain.com