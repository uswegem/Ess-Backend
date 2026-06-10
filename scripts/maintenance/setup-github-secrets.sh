#!/bin/bash

# GitHub Secrets Setup Script for MiraCore ESS Deployment
# This script helps set up the required GitHub repository secrets

echo "🔐 GitHub Secrets Setup for MiraCore ESS"
echo "========================================="
echo ""

REPO_OWNER="uswegem"
REPO_NAME="MiraCore_New"

echo "Repository: ${REPO_OWNER}/${REPO_NAME}"
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    echo ""
    echo "Alternative: Set secrets manually in GitHub web interface:"
    echo "https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/secrets/actions"
    echo ""
    echo "Required secrets:"
    echo "1. SSH_PRIVATE_KEY - Your private SSH key for server access"
    echo ""
    echo "The following values are now configured as environment variables in the workflow:"
    echo "- REMOTE_HOST: 135.181.33.13"
    echo "- REMOTE_USER: uswege" 
    echo "- REMOTE_PATH: /home/uswege/ess"
    exit 1
fi

# Check if user is authenticated with GitHub CLI
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI"
    echo "Please run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is available and authenticated"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    
    echo "Setting up: $secret_name"
    echo "Description: $secret_description"
    echo ""
    
    if [ "$secret_name" == "SSH_PRIVATE_KEY" ]; then
        echo "Please provide the SSH private key content:"
        echo "You can get it by running: cat ~/.ssh/id_rsa"
        echo "Or if you need to generate a new key pair:"
        echo "ssh-keygen -t rsa -b 4096 -C 'github-actions@${REPO_NAME}'"
        echo ""
        echo "Paste the private key content (including -----BEGIN and -----END lines):"
        
        # Read multiline input for SSH key
        echo "Press Ctrl+D when done entering the key:"
        SSH_KEY=$(cat)
        
        if [ -n "$SSH_KEY" ]; then
            echo "$SSH_KEY" | gh secret set SSH_PRIVATE_KEY --repo ${REPO_OWNER}/${REPO_NAME}
            if [ $? -eq 0 ]; then
                echo "✅ SSH_PRIVATE_KEY secret set successfully"
            else
                echo "❌ Failed to set SSH_PRIVATE_KEY secret"
            fi
        else
            echo "❌ No SSH key provided"
        fi
    fi
    
    echo ""
}

echo "🚀 Setting up deployment secrets..."
echo ""

# Set up SSH private key
set_secret "SSH_PRIVATE_KEY" "Private SSH key for server access"

echo "🎉 Secret setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Ensure the corresponding public key is added to the server:"
echo "   ssh-copy-id uswege@135.181.33.13"
echo ""
echo "2. Test the SSH connection:"
echo "   ssh uswege@135.181.33.13 'echo \"Connection successful\"'"
echo ""
echo "3. Commit and push your changes to trigger deployment:"
echo "   git add ."
echo "   git commit -m 'fix: Update deployment workflow'"
echo "   git push origin main"
echo ""
echo "4. Monitor the deployment in GitHub Actions:"
echo "   https://github.com/${REPO_OWNER}/${REPO_NAME}/actions"