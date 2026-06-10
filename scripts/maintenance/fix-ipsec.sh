#!/bin/bash

echo "=============================================="
echo "IPsec Tunnel Restoration Script"
echo "=============================================="
echo ""

# Check if sudo is available
if ! sudo -n true 2>/dev/null; then
    echo "❌ ERROR: sudo is disabled on this machine"
    echo ""
    echo "To fix this issue, you need to:"
    echo "1. Go to Settings app"
    echo "2. Navigate to Developer Settings"
    echo "3. Enable sudo"
    echo ""
    echo "Or contact your system administrator to run:"
    echo "  systemctl restart strongswan-starter"
    echo ""
    exit 1
fi

echo "✅ Sudo access confirmed"
echo ""

# Check current IPsec status
echo "📊 Current IPsec Status:"
sudo ipsec statusall | grep -E "Security Associations|ESTABLISHED|INSTALLED" | head -10
echo ""

# Restart strongswan
echo "🔄 Restarting strongswan service..."
sudo systemctl restart strongswan-starter
sleep 3

# Check service status
echo "📊 Strongswan service status:"
sudo systemctl status strongswan-starter | head -8
echo ""

# Restart IPsec
echo "🔄 Restarting IPsec tunnels..."
sudo ipsec restart
sleep 5

# Check tunnel status
echo "📊 Checking tunnel status..."
ESTABLISHED_COUNT=$(sudo ipsec statusall | grep -c "ESTABLISHED")
INSTALLED_COUNT=$(sudo ipsec statusall | grep -c "INSTALLED")

echo "Tunnels ESTABLISHED: $ESTABLISHED_COUNT"
echo "Tunnels INSTALLED: $INSTALLED_COUNT"
echo ""

if [ "$ESTABLISHED_COUNT" -gt 0 ]; then
    echo "✅ IPsec tunnels are UP!"
    sudo ipsec statusall | grep -E "ESTABLISHED|INSTALLED"
    echo ""
    
    # Test connectivity
    echo "🧪 Testing connectivity to utumishi..."
    if curl --connect-timeout 5 -m 10 -s -o /dev/null -w "%{http_code}" http://154.118.230.140:9802/ess-loans/mvtyztwq/consume; then
        echo ""
        echo "✅ Connectivity to utumishi is working!"
        echo ""
        echo "You can now run:"
        echo "  cd /home/uswege/ess"
        echo "  node send-disbursement-failure-ess1765974145523.js"
    else
        echo ""
        echo "⚠️  Tunnels are up but connectivity test failed"
        echo "Wait 30 seconds for tunnels to fully establish"
    fi
else
    echo "❌ No tunnels established. Check configuration:"
    echo "  cat /etc/ipsec.conf"
    echo "  cat /etc/ipsec.secrets"
fi

echo ""
echo "=============================================="
echo "Script complete"
echo "=============================================="
