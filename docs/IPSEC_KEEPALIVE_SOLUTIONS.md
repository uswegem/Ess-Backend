# IPsec VPN Tunnel Keep-Alive Solutions
## Target: 154.118.230.140:9802 (ESS_UTUMISHI)

---

## **CURRENT PROBLEM**

Your IPsec tunnel to `154.118.230.140` keeps going down due to:
- ❌ **Inactivity timeout** - Connection drops after no traffic for 3600s (1 hour)
- ❌ **DPD (Dead Peer Detection) timeout** - 120s timeout
- ❌ **Remote side closing connection** - ESS side may be dropping the connection
- ❌ **Auto-restart not working properly** - `auto=start` should auto-reconnect but isn't

**Current Configuration Issues:**
```bash
conn ikev2-vpn-140
    also=ikev2-vpn-base
    rightsubnet=154.118.230.140/32
    auto=start  # Should auto-start but not maintaining
    
# From ikev2-vpn-base:
    dpdaction=restart      # Should restart on DPD failure
    dpddelay=30s          # Check peer every 30s
    inactivity=3600s      # ⚠️ Closes after 1 hour of no traffic
```

---

## **SOLUTION OPTIONS**

### **Option 1: Optimize IPsec Configuration** ⭐ **RECOMMENDED**
**Best for:** Long-term stability, proper solution

#### Changes to `/etc/ipsec.conf`:

```bash
conn ikev2-vpn-base
    auto=start              # Changed from 'add' to 'start'
    keyexchange=ikev2
    authby=psk
    ike=aes256-sha256-modp2048!
    esp=aes256-sha256!
    left=135.181.33.13
    leftid=135.181.33.13
    leftsubnet=135.181.33.13/32
    right=154.118.230.138
    rightid=154.118.230.138
    fragmentation=yes
    mobike=no
    
    # Optimized timeouts
    ikelifetime=86400s      # 24 hours
    lifetime=28800s         # 8 hours (increased from 3600s)
    
    # Aggressive keep-alive
    dpdaction=restart       # Auto-restart on failure
    dpddelay=30s           # Check every 30s
    dpdtimeout=150s        # Wait 150s before declaring dead
    
    # ⭐ KEY CHANGES:
    inactivity=0           # DISABLE inactivity timeout (was 3600s)
    # OR
    # inactivity=86400s    # Set to 24 hours
    
    keyingtries=%forever   # Keep trying to reconnect
    rekey=yes              # Auto-rekey before expiry
    closeaction=restart    # ⭐ Restart if closed by remote

conn ikev2-vpn-140
    also=ikev2-vpn-base
    rightsubnet=154.118.230.140/32
    auto=start             # Auto-start on boot
```

**Apply:**
```bash
ssh miracore-prod "sudo nano /etc/ipsec.conf"
# Make the changes above
ssh miracore-prod "sudo ipsec restart"
ssh miracore-prod "sudo ipsec status"
```

**Pros:**
- ✅ Proper solution addressing root cause
- ✅ Auto-reconnect on any failure
- ✅ No external scripts needed
- ✅ Survives reboots

**Cons:**
- ⚠️ Requires server restart
- ⚠️ May need coordination with ESS team

---

### **Option 2: Systemd Keep-Alive Service** ⭐ **RECOMMENDED FOR MONITORING**
**Best for:** Automatic monitoring and restart

#### Create `/etc/systemd/system/ipsec-keepalive.service`:

```bash
ssh miracore-prod "sudo tee /etc/systemd/system/ipsec-keepalive.service > /dev/null << 'EOF'
[Unit]
Description=IPsec Tunnel Keep-Alive for ESS
After=strongswan-starter.service
Requires=strongswan-starter.service

[Service]
Type=simple
ExecStart=/usr/local/bin/ipsec-keepalive.sh
Restart=always
RestartSec=60
User=root

[Install]
WantedBy=multi-user.target
EOF"
```

#### Create `/usr/local/bin/ipsec-keepalive.sh`:

```bash
ssh miracore-prod "sudo tee /usr/local/bin/ipsec-keepalive.sh > /dev/null << 'EOF'
#!/bin/bash

# Configuration
TARGET_IP=\"154.118.230.140\"
TARGET_PORT=\"9802\"
TUNNEL_NAME=\"ikev2-vpn-140\"
CHECK_INTERVAL=60  # Check every 60 seconds
LOG_FILE=\"/var/log/ipsec-keepalive.log\"

log() {
    echo \"[\$(date '+%Y-%m-%d %H:%M:%S')] \$1\" | tee -a \"\$LOG_FILE\"
}

check_tunnel() {
    sudo ipsec status \"\$TUNNEL_NAME\" | grep -q \"ESTABLISHED\"
}

check_connectivity() {
    # Try to connect to the target port
    timeout 5 bash -c \"</dev/tcp/\$TARGET_IP/\$TARGET_PORT\" 2>/dev/null
}

bring_up_tunnel() {
    log \"Bringing up tunnel \$TUNNEL_NAME...\"
    sudo ipsec up \"\$TUNNEL_NAME\" 2>&1 | tee -a \"\$LOG_FILE\"
}

send_keepalive() {
    # Send a simple ping through the tunnel to keep it alive
    sudo ping -c 1 -W 2 \"\$TARGET_IP\" > /dev/null 2>&1
}

log \"IPsec Keep-Alive Service Started\"

while true; do
    if ! check_tunnel; then
        log \"⚠️ Tunnel \$TUNNEL_NAME is DOWN. Attempting to reconnect...\"
        bring_up_tunnel
        sleep 10
    elif ! check_connectivity; then
        log \"⚠️ Cannot reach \$TARGET_IP:\$TARGET_PORT. Tunnel may be stale.\"
        log \"Restarting tunnel...\"
        sudo ipsec down \"\$TUNNEL_NAME\" 2>&1 | tee -a \"\$LOG_FILE\"
        sleep 2
        bring_up_tunnel
        sleep 10
    else
        # Tunnel is up and connectivity is good - send keepalive
        send_keepalive
        log \"✅ Tunnel \$TUNNEL_NAME is UP and reachable\"
    fi
    
    sleep \"\$CHECK_INTERVAL\"
done
EOF"

# Make executable
ssh miracore-prod "sudo chmod +x /usr/local/bin/ipsec-keepalive.sh"

# Enable and start service
ssh miracore-prod "sudo systemctl daemon-reload"
ssh miracore-prod "sudo systemctl enable ipsec-keepalive.service"
ssh miracore-prod "sudo systemctl start ipsec-keepalive.service"

# Check status
ssh miracore-prod "sudo systemctl status ipsec-keepalive.service"
```

**Monitor logs:**
```bash
ssh miracore-prod "sudo tail -f /var/log/ipsec-keepalive.log"
```

**Pros:**
- ✅ Automatic monitoring every 60 seconds
- ✅ Auto-restart on failure
- ✅ Starts on boot
- ✅ Detailed logging
- ✅ Can be combined with Option 1

**Cons:**
- ⚠️ Additional service to maintain
- ⚠️ May cause unnecessary reconnections

---

### **Option 3: Cron Job with Simple Ping** 💡 **QUICK FIX**
**Best for:** Immediate temporary solution

```bash
ssh miracore-prod "sudo crontab -e"
# Add these lines:

# Check tunnel every 2 minutes
*/2 * * * * /usr/sbin/ipsec status ikev2-vpn-140 | grep -q ESTABLISHED || /usr/sbin/ipsec up ikev2-vpn-140

# Send keepalive ping every 5 minutes
*/5 * * * * /bin/ping -c 1 154.118.230.140 > /dev/null 2>&1
```

**Or create a script:**
```bash
ssh miracore-prod "sudo tee /usr/local/bin/check-ipsec.sh > /dev/null << 'EOF'
#!/bin/bash
if ! /usr/sbin/ipsec status ikev2-vpn-140 | grep -q ESTABLISHED; then
    echo \"[\$(date)] Tunnel down, reconnecting...\" >> /var/log/ipsec-check.log
    /usr/sbin/ipsec up ikev2-vpn-140 >> /var/log/ipsec-check.log 2>&1
fi
# Send keepalive
/bin/ping -c 1 154.118.230.140 > /dev/null 2>&1
EOF"

ssh miracore-prod "sudo chmod +x /usr/local/bin/check-ipsec.sh"

# Add to crontab
ssh miracore-prod "echo '*/2 * * * * /usr/local/bin/check-ipsec.sh' | sudo crontab -"
```

**Pros:**
- ✅ Very simple to implement
- ✅ Works immediately
- ✅ Low overhead

**Cons:**
- ⚠️ 2-minute gap between checks
- ⚠️ Not as elegant as systemd service
- ⚠️ Limited error handling

---

### **Option 4: Application-Level Keep-Alive in Node.js** 🔧
**Best for:** Application-specific solution

#### Create `ipsec-monitor.js`:

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const TARGET_IP = '154.118.230.140';
const TARGET_PORT = 9802;
const CHECK_INTERVAL = 60000; // 60 seconds

async function checkTunnel() {
    try {
        const { stdout } = await execPromise('sudo ipsec status ikev2-vpn-140');
        return stdout.includes('ESTABLISHED');
    } catch (error) {
        return false;
    }
}

async function checkConnectivity() {
    try {
        const { stdout } = await execPromise(`timeout 5 bash -c "</dev/tcp/${TARGET_IP}/${TARGET_PORT}"`);
        return true;
    } catch (error) {
        return false;
    }
}

async function bringUpTunnel() {
    console.log(`[${new Date().toISOString()}] Bringing up tunnel...`);
    try {
        const { stdout } = await execPromise('sudo ipsec up ikev2-vpn-140');
        console.log(stdout);
        return true;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error:`, error.message);
        return false;
    }
}

async function sendKeepalive() {
    try {
        await execPromise(`ping -c 1 -W 2 ${TARGET_IP}`);
    } catch (error) {
        // Ignore errors
    }
}

async function monitor() {
    console.log(`[${new Date().toISOString()}] Starting IPsec monitor...`);
    
    setInterval(async () => {
        const tunnelUp = await checkTunnel();
        
        if (!tunnelUp) {
            console.log(`[${new Date().toISOString()}] ⚠️ Tunnel DOWN. Reconnecting...`);
            await bringUpTunnel();
        } else {
            const canConnect = await checkConnectivity();
            
            if (!canConnect) {
                console.log(`[${new Date().toISOString()}] ⚠️ Cannot reach ${TARGET_IP}:${TARGET_PORT}`);
                console.log('Restarting tunnel...');
                await execPromise('sudo ipsec down ikev2-vpn-140');
                await new Promise(resolve => setTimeout(resolve, 2000));
                await bringUpTunnel();
            } else {
                // Send keepalive
                await sendKeepalive();
                console.log(`[${new Date().toISOString()}] ✅ Tunnel UP and reachable`);
            }
        }
    }, CHECK_INTERVAL);
}

monitor();
```

**Run with PM2:**
```bash
ssh miracore-prod "cd ~/ess && pm2 start ipsec-monitor.js --name ipsec-monitor"
ssh miracore-prod "cd ~/ess && pm2 save"
```

**Pros:**
- ✅ Integrated with your Node.js stack
- ✅ Easy to customize
- ✅ Can add Slack/email notifications
- ✅ Managed by PM2 (already in use)

**Cons:**
- ⚠️ Requires Node.js to be running
- ⚠️ Needs sudo permissions for ipsec commands

---

### **Option 5: Configure Remote Side (ESS)** 📞
**Best for:** Proper long-term solution

**Contact ESS team to:**
1. Increase inactivity timeout on their side
2. Configure keepalive packets from their end
3. Ensure `closeaction=restart` is set on both sides
4. Verify DPD settings match on both ends
5. Check if they have firewall rules dropping idle connections

**Configuration to request:**
```bash
# On ESS side (154.118.230.138/140)
conn miracore-connection
    inactivity=0              # Or very high value
    dpdaction=restart
    dpddelay=30s
    closeaction=restart
    keyingtries=%forever
```

**Pros:**
- ✅ Root cause solution
- ✅ Most stable long-term
- ✅ No workarounds needed

**Cons:**
- ⚠️ Requires ESS cooperation
- ⚠️ May take time to implement

---

### **Option 6: Hybrid HTTP Health Check + Auto-Restart** 🎯
**Best for:** Production reliability

#### Create health check endpoint in your app:

```javascript
// In your Express app
app.get('/health/ipsec', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        // Check tunnel status
        const { stdout } = await execPromise('sudo ipsec status ikev2-vpn-140');
        const isUp = stdout.includes('ESTABLISHED');
        
        if (!isUp) {
            // Try to bring it up
            await execPromise('sudo ipsec up ikev2-vpn-140');
        }
        
        res.json({
            status: isUp ? 'up' : 'reconnecting',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});
```

#### External monitoring (UptimeRobot, Pingdom, etc.):
- Monitor: `http://135.181.33.13:3002/health/ipsec`
- Interval: Every 2 minutes
- Alert on failures

**Pros:**
- ✅ External monitoring
- ✅ Can integrate with existing monitoring tools
- ✅ Email/SMS alerts on failures

**Cons:**
- ⚠️ Requires external service
- ⚠️ May have API rate limits

---

## **RECOMMENDED IMPLEMENTATION STRATEGY**

### **Immediate (Today):**
1. ✅ **Fix IPsec config** (Option 1)
   - Set `inactivity=0` or `86400s`
   - Set `closeaction=restart`
   - Change base `auto=start`

2. ✅ **Deploy cron job** (Option 3)
   - Quick safety net while testing

### **Short-term (This Week):**
3. ✅ **Deploy systemd service** (Option 2)
   - Proper monitoring solution
   - Replace cron job

### **Long-term (Next Sprint):**
4. ✅ **Contact ESS** (Option 5)
   - Request proper timeout configuration
   
5. ✅ **Add application monitoring** (Option 6)
   - Integrate with your Node.js app
   - External health checks

---

## **QUICK START - APPLY NOW**

### **1. Fix IPsec Configuration:**
```bash
ssh miracore-prod "sudo cp /etc/ipsec.conf /etc/ipsec.conf.backup"
ssh miracore-prod "sudo sed -i 's/inactivity=3600s/inactivity=0/' /etc/ipsec.conf"
ssh miracore-prod "sudo sed -i 's/auto=add/auto=start/' /etc/ipsec.conf"
ssh miracore-prod "sudo ipsec restart"
ssh miracore-prod "sudo ipsec up ikev2-vpn-140"
ssh miracore-prod "sudo ipsec status ikev2-vpn-140"
```

### **2. Add Cron Job (Temporary):**
```bash
ssh miracore-prod "echo '*/2 * * * * /usr/sbin/ipsec status ikev2-vpn-140 | grep -q ESTABLISHED || /usr/sbin/ipsec up ikev2-vpn-140' | sudo crontab -"
```

### **3. Test:**
```bash
# Wait 10 minutes and check
ssh miracore-prod "sudo ipsec status ikev2-vpn-140"
ssh miracore-prod "sudo ping -c 3 154.118.230.140"
```

---

## **MONITORING COMMANDS**

```bash
# Check tunnel status
ssh miracore-prod "sudo ipsec status"

# Check specific tunnel
ssh miracore-prod "sudo ipsec status ikev2-vpn-140"

# View logs
ssh miracore-prod "sudo tail -f /var/log/syslog | grep charon"

# Manual restart
ssh miracore-prod "sudo ipsec restart"

# Bring up specific tunnel
ssh miracore-prod "sudo ipsec up ikev2-vpn-140"

# Check connectivity
ssh miracore-prod "sudo ping -c 5 154.118.230.140"
```

---

## **EXPECTED RESULTS**

After implementing Options 1 + 2:
- ✅ Tunnel stays up 24/7
- ✅ Auto-reconnects within 60 seconds if dropped
- ✅ Survives server reboots
- ✅ No manual intervention needed
- ✅ Full visibility via logs

**Test Period:** Monitor for 24-48 hours to confirm stability.
