#!/bin/bash

# Configuration
TARGET_IP="154.118.230.140"
TUNNEL_NAME="ikev2-vpn-140"
CHECK_INTERVAL=120  # Increased to 2 minutes to reduce CPU/IO
LOG_FILE="/var/log/ipsec-keepalive.log"
MAX_LOG_LINES=500
LOG_INTERVAL=15  # Log success every 15 checks (30 minutes)

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" >> "$LOG_FILE"
    
    # Auto-trim log file periodically
    if [ $((RANDOM % 50)) -eq 0 ]; then
        local line_count=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
        if [ "$line_count" -gt "$MAX_LOG_LINES" ]; then
            tail -n "$MAX_LOG_LINES" "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null && mv "$LOG_FILE.tmp" "$LOG_FILE" 2>/dev/null
        fi
    fi
}

check_tunnel() {
    ipsec status "$TUNNEL_NAME" 2>/dev/null | grep -q "INSTALLED"
}

check_connectivity() {
    ping -c 1 -W 3 "$TARGET_IP" > /dev/null 2>&1
}

bring_up_tunnel() {
    log "‚ö†Ô∏è Bringing up tunnel $TUNNEL_NAME..."
    ipsec up "$TUNNEL_NAME" >> "$LOG_FILE" 2>&1
}

restart_tunnel() {
    log "Ì¥Ñ Restarting stale tunnel $TUNNEL_NAME..."
    ipsec down "$TUNNEL_NAME" >> "$LOG_FILE" 2>&1
    sleep 3
    bring_up_tunnel
}

log "Ì∫Ä IPsec Keep-Alive Service Started (PID: $$, interval: ${CHECK_INTERVAL}s)"

check_count=0

while true; do
    if ! check_tunnel; then
        log "‚ùå Tunnel $TUNNEL_NAME is DOWN. Reconnecting..."
        bring_up_tunnel
        check_count=0
        sleep 10
    elif ! check_connectivity; then
        log "‚ö†Ô∏è Cannot ping $TARGET_IP. Tunnel may be stale."
        restart_tunnel
        check_count=0
        sleep 10
    else
        ((check_count++))
        if [ $((check_count % LOG_INTERVAL)) -eq 0 ]; then
            log "‚úÖ Tunnel healthy (${check_count} checks, $(($check_count * $CHECK_INTERVAL / 60)) min uptime)"
        fi
    fi
    
    sleep "$CHECK_INTERVAL"
done
