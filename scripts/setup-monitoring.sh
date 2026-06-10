#!/bin/bash

# Enhanced Connectivity Monitoring Setup Script
# This script sets up comprehensive monitoring for Utumishi ESS connectivity

set -e

echo "🚀 Setting up Enhanced ESS Connectivity Monitoring"
echo "=================================================="

# Configuration
ESS_HOME="/home/uswege/ess"
SCRIPTS_DIR="$ESS_HOME/scripts"
LOGS_DIR="$ESS_HOME/logs"
SERVICE_FILE="/etc/systemd/system/ess-connectivity-monitor.service"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root for some operations
check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        echo "Please run with sudo for system service installation"
        echo "Usage: sudo ./setup-monitoring.sh"
        exit 1
    fi
}

# Step 1: Create directories
setup_directories() {
    print_step "Creating monitoring directories..."
    
    mkdir -p "$SCRIPTS_DIR"
    mkdir -p "$LOGS_DIR"
    
    # Set proper permissions
    chown -R uswege:uswege "$ESS_HOME"
    chmod +x "$SCRIPTS_DIR"/*.sh 2>/dev/null || true
    chmod +x "$SCRIPTS_DIR"/*.js 2>/dev/null || true
}

# Step 2: Install dependencies
install_dependencies() {
    print_step "Installing system dependencies..."
    
    # Update package list
    apt-get update -qq
    
    # Install required packages
    apt-get install -y cron logrotate curl net-tools
    
    # Ensure strongSwan is installed for IPSec
    if ! command -v ipsec &> /dev/null; then
        print_warning "Installing strongSwan IPSec..."
        apt-get install -y strongswan strongswan-pki
    fi
}

# Step 3: Setup systemd service
setup_systemd_service() {
    print_step "Setting up systemd service..."
    
    # Copy service file
    if [ -f "$SCRIPTS_DIR/ess-connectivity-monitor.service" ]; then
        cp "$SCRIPTS_DIR/ess-connectivity-monitor.service" "$SERVICE_FILE"
        
        # Reload systemd
        systemctl daemon-reload
        
        # Enable service
        systemctl enable ess-connectivity-monitor.service
        
        print_step "Systemd service installed and enabled"
    else
        print_error "Service file not found at $SCRIPTS_DIR/ess-connectivity-monitor.service"
    fi
}

# Step 4: Setup cron jobs
setup_cron_jobs() {
    print_step "Setting up cron jobs for user 'uswege'..."
    
    # Create temporary cron file
    TEMP_CRON=$(mktemp)
    
    # Get existing cron jobs for uswege user
    sudo -u uswege crontab -l 2>/dev/null > "$TEMP_CRON" || true
    
    # Add monitoring cron jobs if not already present
    if ! grep -q "ipsec-monitor.sh" "$TEMP_CRON"; then
        echo "# ESS IPSec Tunnel Monitor - every 5 minutes" >> "$TEMP_CRON"
        echo "*/5 * * * * $SCRIPTS_DIR/ipsec-monitor.sh" >> "$TEMP_CRON"
    fi
    
    if ! grep -q "connectivity-monitor.js check" "$TEMP_CRON"; then
        echo "# ESS Connectivity Check - every 2 minutes" >> "$TEMP_CRON"
        echo "*/2 * * * * /usr/bin/node $SCRIPTS_DIR/connectivity-monitor.js check" >> "$TEMP_CRON"
    fi
    
    if ! grep -q "daily-connectivity-report" "$TEMP_CRON"; then
        echo "# Daily connectivity report - 6 AM" >> "$TEMP_CRON"
        echo "0 6 * * * /usr/bin/node $SCRIPTS_DIR/connectivity-monitor.js status >> $LOGS_DIR/daily-connectivity-report.log" >> "$TEMP_CRON"
    fi
    
    if ! grep -q "find.*logs.*-mtime" "$TEMP_CRON"; then
        echo "# Clean old logs - weekly at 2 AM Sunday" >> "$TEMP_CRON"
        echo "0 2 * * 0 find $LOGS_DIR -name \"*.log\" -mtime +30 -delete" >> "$TEMP_CRON"
    fi
    
    # Install the new crontab
    sudo -u uswege crontab "$TEMP_CRON"
    rm "$TEMP_CRON"
    
    print_step "Cron jobs installed for automated monitoring"
}

# Step 5: Setup log rotation
setup_log_rotation() {
    print_step "Setting up log rotation..."
    
    cat > /etc/logrotate.d/ess-monitoring << EOF
$LOGS_DIR/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 uswege uswege
    postrotate
        # Restart monitoring service if running
        systemctl is-active --quiet ess-connectivity-monitor && systemctl reload ess-connectivity-monitor || true
    endscript
}
EOF

    print_step "Log rotation configured"
}

# Step 6: Configure sudo permissions for uswege user
setup_sudo_permissions() {
    print_step "Setting up sudo permissions for IPSec management..."
    
    # Create sudoers file for uswege user to manage IPSec without password
    cat > /etc/sudoers.d/ess-ipsec << EOF
# Allow uswege user to manage IPSec tunnels for ESS monitoring
uswege ALL=(ALL) NOPASSWD: /usr/sbin/ipsec status, /usr/sbin/ipsec restart, /usr/sbin/ipsec start, /usr/sbin/ipsec stop
# Allow basic network diagnostics
uswege ALL=(ALL) NOPASSWD: /bin/ping
EOF

    # Set proper permissions
    chmod 440 /etc/sudoers.d/ess-ipsec
    
    print_step "Sudo permissions configured for IPSec management"
}

# Step 7: Start services
start_services() {
    print_step "Starting monitoring services..."
    
    # Start systemd service
    if systemctl is-enabled --quiet ess-connectivity-monitor; then
        systemctl start ess-connectivity-monitor
        print_step "Enhanced connectivity monitor started"
    fi
    
    # Ensure cron is running
    systemctl enable cron
    systemctl start cron
    print_step "Cron service ensured running"
}

# Step 8: Validate setup
validate_setup() {
    print_step "Validating monitoring setup..."
    
    # Check systemd service
    if systemctl is-active --quiet ess-connectivity-monitor; then
        print_step "✓ Systemd service is running"
    else
        print_warning "⚠ Systemd service is not running"
    fi
    
    # Check cron jobs
    if sudo -u uswege crontab -l | grep -q "ipsec-monitor"; then
        print_step "✓ Cron jobs are installed"
    else
        print_warning "⚠ Cron jobs not found"
    fi
    
    # Check log directory
    if [ -d "$LOGS_DIR" ] && [ -w "$LOGS_DIR" ]; then
        print_step "✓ Log directory is writable"
    else
        print_warning "⚠ Log directory issue"
    fi
    
    # Test IPSec access
    if sudo -u uswege sudo ipsec status >/dev/null 2>&1; then
        print_step "✓ IPSec access configured"
    else
        print_warning "⚠ IPSec access not working"
    fi
}

# Step 9: Display summary
display_summary() {
    echo ""
    echo "=================================================="
    echo "🎉 Enhanced ESS Monitoring Setup Complete!"
    echo "=================================================="
    echo ""
    echo "Services installed:"
    echo "  • Enhanced Connectivity Monitor (systemd)"
    echo "  • IPSec Tunnel Monitor (cron)"
    echo "  • Automated Recovery System"
    echo "  • Log Rotation"
    echo ""
    echo "Monitoring frequency:"
    echo "  • IPSec tunnel check: Every 5 minutes"
    echo "  • Connectivity check: Every 2 minutes"
    echo "  • Daily reports: 6:00 AM"
    echo "  • Log cleanup: Weekly"
    echo ""
    echo "Commands:"
    echo "  • Check status: systemctl status ess-connectivity-monitor"
    echo "  • View logs: tail -f $LOGS_DIR/connectivity-monitor.log"
    echo "  • Manual test: node $SCRIPTS_DIR/connectivity-monitor.js check"
    echo ""
    echo "Next steps:"
    echo "  1. Monitor logs for initial operation"
    echo "  2. Configure alerting endpoints (email/SMS)"
    echo "  3. Test recovery procedures"
    echo ""
}

# Main execution
main() {
    echo "Starting Enhanced ESS Monitoring Setup..."
    
    # Check if we need sudo
    if [ "$1" != "--no-sudo-check" ]; then
        check_sudo
    fi
    
    setup_directories
    install_dependencies
    setup_systemd_service
    setup_cron_jobs
    setup_log_rotation
    setup_sudo_permissions
    start_services
    validate_setup
    display_summary
}

# Run main function
main "$@"