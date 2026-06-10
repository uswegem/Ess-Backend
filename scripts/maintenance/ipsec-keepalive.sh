#!/bin/bash

# Configuration
TARGET_IP="154.118.230.140"
TARGET_PORT="9802"
TUNNEL_NAME="ikev2-vpn-140"
CHECK_INTERVAL=60
LOG_FILE="/var/log/ipsec-keepalive.log"
MAX_LOG_LINES=1000

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    
    # Trim log file if it gets too large (keep last 1000 lines)
    local line_count=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$line_count" -gt "$MAX_LOG_LINES" ]; then
        tail -n "$MAX_LOG_LINES" "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
}

check_tunnel() {
    # Check if tunnel is installed (active)
    ipsec status "$TUNNEL_NAME" 2>/dev/null | grep -q "INSTALLED"
}

check_connectivity() {
    # Simple ping is more efficient than TCP connection test
    ping -c 1 -W 2 "$TARGET_IP" > /dev/null 2>&1
}

bring_up_tunnel() {
    log "Bringing up tunnel $TUNNEL_NAME..."
    ipsec up "$TUNNEL_NAME" >> "$LOG_FILE" 2>&1
}

send_keepalive() {
    # Already done in check_connectivity, no need to ping twice
    :
}

log "IPsec Keep-Alive Service Started (PID: $$)"

# Counter to reduce logging frequency
check_count=0
log_every=10  # Log success message every 10 checks (10 minutes)

while true; do
    if ! check_tunnel; then
        log "⚠️ Tunnel $TUNNEL_NAME is DOWN. Attempting to reconnect..."
        bring_up_tunnel
        check_count=0  # Reset counter after reconnection
        sleep 10
    elif ! check_connectivity; then
        log "⚠️ Cannot reach $TARGET_IP. Tunnel may be stale. Restarting..."
        ipsec down "$TUNNEL_NAME" >> "$LOG_FILE" 2>&1
        sleep 2
        bring_up_tunnel
        check_count=0  # Reset counter after restart
        sleep 10
    else
        # Tunnel is up and reachable
        ((check_count++))
        
        # Only log every N successful checks to reduce I/O
        if [ $((check_count % log_every)) -eq 0 ]; then
            log "✅ Tunnel $TUNNEL_NAME is UP and reachable (${check_count} checks)"
        fi
    fi
    
    sleep "$CHECK_INTERVAL"
done
