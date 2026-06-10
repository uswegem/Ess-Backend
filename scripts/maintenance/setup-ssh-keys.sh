#!/bin/bash

echo "🔐 SSH Key Setup for MiraCore Servers"
echo "====================================="
echo ""

# Check if SSH keys exist
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "📝 Generating SSH key pair..."
    ssh-keygen -t rsa -b 4096 -C "miracore-deployment" -f ~/.ssh/id_rsa -N ""
    echo "✅ SSH key pair generated"
else
    echo "✅ SSH key pair already exists"
fi

echo ""
echo "📋 Your public key:"
echo "=================="
cat ~/.ssh/id_rsa.pub
echo ""

echo "🚀 Setup Instructions:"
echo "====================="
echo ""
echo "STEP 1: Copy the public key above"
echo ""
echo "STEP 2: Add to ESS Backend Server (135.181.33.13)"
echo "------------------------------------------------"
echo "ssh uswege@135.181.33.13"
echo "mkdir -p ~/.ssh"
echo "echo 'YOUR_PUBLIC_KEY_HERE' >> ~/.ssh/authorized_keys"
echo "chmod 700 ~/.ssh"
echo "chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "STEP 3: Add to Admin Portal Server (5.75.185.137)"
echo "------------------------------------------------"
echo "ssh uswege@5.75.185.137"
echo "mkdir -p ~/.ssh"
echo "echo 'YOUR_PUBLIC_KEY_HERE' >> ~/.ssh/authorized_keys"
echo "chmod 700 ~/.ssh"
echo "chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "STEP 4: Setup GitHub SSH Key"
echo "---------------------------"
echo "1. Go to https://github.com/settings/keys"
echo "2. Click 'New SSH key'"
echo "3. Paste the public key above"
echo "4. Title it 'MiraCore Deployment Key'"
echo ""
echo "STEP 5: Test SSH connections"
echo "---------------------------"
echo "ssh -T git@github.com"
echo "ssh uswege@135.181.33.13 'echo Connected to ESS Backend'"
echo "ssh uswege@5.75.185.137 'echo Connected to Admin Portal'"