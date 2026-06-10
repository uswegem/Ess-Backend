#!/bin/bash

# Automated GitHub Secret Setup for CI/CD
# This script adds the SSH_PRIVATE_KEY secret to GitHub

REPO_OWNER="uswegem"
REPO_NAME="MiraCore_New"
SECRET_NAME="SSH_PRIVATE_KEY"

echo "========================================="
echo "GitHub CI/CD Authentication Setup"
echo "========================================="
echo ""

echo "Step 1: Add Deploy Key to GitHub"
echo "---------------------------------"
echo ""
echo "Server Public Key (add this to GitHub):"
echo ""
ssh uswege@135.181.33.13 "cat ~/.ssh/id_ed25519.pub"
echo ""
echo "👉 Add this key at: https://github.com/$REPO_OWNER/$REPO_NAME/settings/keys"
echo "   - Click 'Add deploy key'"
echo "   - Title: Production Server - 135.181.33.13"
echo "   - Paste the key above"
echo "   - ✅ Enable 'Allow write access'"
echo ""
read -p "Press Enter after adding the deploy key..."

echo ""
echo "Step 2: Test GitHub SSH Connection"
echo "-----------------------------------"
echo ""
ssh uswege@135.181.33.13 "ssh -T git@github.com 2>&1" || echo "⚠️  Authentication test (this is expected if key not added yet)"
echo ""

echo "Step 3: Add SSH_PRIVATE_KEY Secret to GitHub Actions"
echo "-----------------------------------------------------"
echo ""
echo "Server Private Key:"
echo ""
ssh uswege@135.181.33.13 "cat ~/.ssh/id_ed25519"
echo ""
echo "👉 Add this to GitHub Secrets:"
echo "   1. Go to: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
echo "   2. Click 'New repository secret'"
echo "   3. Name: SSH_PRIVATE_KEY"
echo "   4. Value: Paste the ENTIRE private key above (including BEGIN/END lines)"
echo "   5. Click 'Add secret'"
echo ""
read -p "Press Enter after adding the secret..."

echo ""
echo "Step 4: Verify Setup"
echo "--------------------"
echo ""

# Test SSH connection again
echo "Testing GitHub SSH authentication..."
if ssh uswege@135.181.33.13 "ssh -T git@github.com 2>&1" | grep -q "successfully authenticated"; then
    echo "✅ GitHub SSH authentication successful!"
else
    echo "⚠️  SSH authentication test failed. Please verify the deploy key is added correctly."
fi

# Test git pull
echo ""
echo "Testing git pull from production server..."
if ssh uswege@135.181.33.13 "cd /home/uswege/ess && git fetch origin 2>&1"; then
    echo "✅ Git fetch successful!"
else
    echo "❌ Git fetch failed. Check the deploy key permissions."
fi

echo ""
echo "========================================="
echo "Setup Summary"
echo "========================================="
echo ""
echo "✅ Git remote changed to SSH (git@github.com:$REPO_OWNER/$REPO_NAME.git)"
echo ""
echo "Next steps:"
echo "1. Verify deploy key is added at: https://github.com/$REPO_OWNER/$REPO_NAME/settings/keys"
echo "2. Verify secret is added at: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
echo "3. Trigger a deployment:"
echo "   git commit --allow-empty -m 'test: Verify CI/CD authentication'"
echo "   git push origin main"
echo "4. Monitor at: https://github.com/$REPO_OWNER/$REPO_NAME/actions"
echo ""
