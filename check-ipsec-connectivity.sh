#!/bin/bash

echo "=========================================="
echo "IPsec & Utumishi Connectivity Check"
echo "=========================================="
echo ""

echo "1. Checking IPsec service status..."
sudo systemctl status strongswan-starter | head -10
echo ""

echo "2. Checking IPsec tunnels..."
sudo ipsec statusall | grep -E "Security Associations|ESTABLISHED|INSTALLED" | head -20
echo ""

echo "3. Testing ping to utumishi gateway (154.118.230.138)..."
ping -c 3 154.118.230.138
echo ""

echo "4. Testing ping to utumishi endpoint (154.118.230.140)..."
ping -c 3 154.118.230.140
echo ""

echo "5. Testing HTTP connectivity to utumishi..."
curl -v --max-time 10 http://154.118.230.140:9802/ess-loans/mvtyztwq/consume 2>&1 | head -30
echo ""

echo "6. Checking if IPsec tunnels need restart..."
ESTABLISHED=$(sudo ipsec statusall | grep -c "ESTABLISHED")
if [ "$ESTABLISHED" -eq 0 ]; then
    echo "⚠️  No ESTABLISHED tunnels found. Restarting IPsec..."
    sudo ipsec restart
    sleep 5
    sudo ipsec statusall | grep -E "ESTABLISHED|INSTALLED"
else
    echo "✅ Found $ESTABLISHED ESTABLISHED tunnel(s)"
fi
echo ""

echo "=========================================="
echo "Connectivity check complete!"
echo "=========================================="
