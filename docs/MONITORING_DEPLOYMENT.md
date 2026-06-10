# Enhanced ESS Connectivity Monitoring System

This deployment includes comprehensive monitoring to ensure always-live connectivity to Utumishi at `http://154.118.230.140:9802`.

## 🚀 Deployment Features

### 1. **Enhanced Keep-Alive Service**
- **Service**: `ess-keep-alive` (PM2 managed)
- **Function**: Maintains persistent connection to Utumishi
- **Frequency**: Every 2 minutes
- **Auto-Recovery**: Automatic IPSec tunnel restart on failure
- **Logs**: `logs/keep-alive.log` and `logs/keep-alive-error.log`

### 2. **IPSec Tunnel Monitor**
- **Script**: `scripts/ipsec-monitor.sh`
- **Schedule**: Every 5 minutes (cron)
- **Function**: Monitors and auto-restarts IPSec tunnels
- **Expected Tunnels**: 4 active connections
- **Recovery**: Automatic tunnel restart on degradation

### 3. **Connectivity Monitor**
- **Script**: `scripts/connectivity-monitor.js`
- **Schedule**: Every 2 minutes (cron)
- **Function**: Multi-layer connectivity testing
- **Tests**: Network ping, IPSec status, HTTP endpoint
- **Recovery**: Full recovery sequence on failure

### 4. **Automated Reporting**
- **Daily Reports**: 6:00 AM daily connectivity summary
- **Log Cleanup**: Weekly cleanup of logs older than 30 days
- **Location**: `logs/daily-connectivity-report.log`

## 📊 Monitoring Status Commands

```bash
# Check PM2 services
pm2 list

# View keep-alive logs
pm2 logs ess-keep-alive --lines 50

# Check cron jobs
crontab -l

# Manual connectivity test
node scripts/connectivity-monitor.js check

# View monitoring status
node scripts/connectivity-monitor.js status

# Check IPSec tunnel status
sudo ipsec status
```

## 🔧 Configuration

### Environment Variables
- `UTUMISHI_ENDPOINT`: Target endpoint (default: http://154.118.230.140:9802)
- `NODE_ENV`: Environment mode (production)

### Monitoring Intervals
- Keep-alive pings: 2 minutes
- IPSec checks: 5 minutes
- Connectivity tests: 2 minutes

### Recovery Thresholds
- Max consecutive failures: 3
- Recovery timeout: 60 seconds
- Stabilization time: 30 seconds

## 🚨 Alert System

The monitoring system includes comprehensive logging and can be extended with:
- Email notifications
- SMS alerts
- Slack webhooks
- SNMP traps

Configuration available in `config/monitoring.conf`.

## 📁 File Structure

```
├── scripts/
│   ├── connectivity-monitor.js     # Main monitoring service
│   ├── ipsec-monitor.sh           # IPSec tunnel monitor
│   └── setup-monitoring.sh        # Installation script
├── src/services/
│   ├── keepAliveService.js        # Original keep-alive
│   └── enhancedKeepAliveService.js # Enhanced version
├── config/
│   └── monitoring.conf            # Configuration file
└── logs/
    ├── keep-alive.log            # Keep-alive service logs
    ├── connectivity-monitor.log   # Monitoring logs
    └── daily-connectivity-report.log # Daily reports
```

## 🔄 Automatic Recovery Process

1. **Detection**: Service detects connectivity failure
2. **Diagnosis**: Tests network, IPSec, and application layers
3. **Recovery**: Restarts IPSec tunnel if needed
4. **Validation**: Confirms connectivity restoration
5. **Alerting**: Logs results and sends alerts if configured

## 🎯 Success Metrics

- **Uptime**: >99.5% connectivity to Utumishi
- **Recovery Time**: <2 minutes for automatic recovery
- **Detection Time**: <2 minutes for failure detection
- **False Positives**: <1% alert accuracy

## 🚀 Deployment Status

✅ Enhanced keep-alive service with PM2  
✅ Automated IPSec tunnel monitoring  
✅ Multi-layer connectivity testing  
✅ Automatic recovery procedures  
✅ Comprehensive logging system  
✅ Cron-based scheduled monitoring  
✅ Log rotation and cleanup  

## 🔍 Troubleshooting

### Common Issues

1. **Keep-alive service not starting**
   ```bash
   pm2 restart ess-keep-alive
   pm2 logs ess-keep-alive
   ```

2. **IPSec tunnel down**
   ```bash
   sudo ipsec restart
   sudo ipsec status
   ```

3. **Cron jobs not running**
   ```bash
   service cron status
   crontab -l
   ```

4. **Permission issues**
   ```bash
   sudo visudo /etc/sudoers.d/ess-ipsec
   ```

### Log Locations
- Application logs: `logs/app-*.log`
- Keep-alive logs: `logs/keep-alive.log`
- Monitoring logs: `logs/connectivity-monitor.log`
- System logs: `/var/log/syslog`

## 📞 Support

For monitoring system issues:
1. Check service status with `pm2 list`
2. Review logs in `logs/` directory
3. Test connectivity manually with monitoring scripts
4. Verify IPSec tunnel status

---

**Last Updated**: December 2, 2025  
**Version**: 2.0 (Enhanced Monitoring)  
**Deployment**: Automated via GitHub Actions