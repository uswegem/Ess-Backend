#!/bin/bash

echo "🔐 SSH Key Setup for MiraCore Servers"
echo "===================================="
echo ""

# Server details
PROD_SERVER="135.181.33.13"
ADMIN_SERVER="5.75.185.137"
USER="uswege"

echo "📋 Setting up SSH keys for:"
echo "   - Production ESS Backend: $USER@$PROD_SERVER"
echo "   - Admin Portal Server: $USER@$ADMIN_SERVER"
echo ""

# Function to generate SSH key if it doesn't exist
generate_ssh_key() {
    local key_name=$1
    local email=$2
    
    if [ ! -f ~/.ssh/$key_name ]; then
        echo "🔑 Generating SSH key: $key_name"
        ssh-keygen -t ed25519 -C "$email" -f ~/.ssh/$key_name -N ""
        echo "✅ SSH key generated: ~/.ssh/$key_name"
    else
        echo "✅ SSH key already exists: ~/.ssh/$key_name"
    fi
}

# Function to copy SSH key to server
copy_ssh_key() {
    local key_file=$1
    local server=$2
    local user=$3
    
    echo "📤 Copying SSH key to $user@$server..."
    
    if ssh-copy-id -i ~/.ssh/$key_file.pub $user@$server; then
        echo "✅ SSH key copied successfully to $user@$server"
    else
        echo "❌ Failed to copy SSH key to $user@$server"
        echo "💡 Try manual copy method:"
        echo "   cat ~/.ssh/$key_file.pub | ssh $user@$server 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'"
    fi
}

# Function to test SSH connection
test_ssh_connection() {
    local server=$1
    local user=$2
    
    echo "🧪 Testing SSH connection to $user@$server..."
    
    if ssh -o ConnectTimeout=10 -o BatchMode=yes $user@$server 'echo "SSH connection successful"' 2>/dev/null; then
        echo "✅ SSH connection working: $user@$server"
        return 0
    else
        echo "❌ SSH connection failed: $user@$server"
        return 1
    fi
}

# Function to setup GitHub SSH access
setup_github_ssh() {
    local server=$1
    local user=$2
    
    echo "🐙 Setting up GitHub SSH access on $user@$server..."
    
    ssh $user@$server << 'EOF'
# Check if GitHub SSH key exists
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "🔑 Generating GitHub SSH key..."
    ssh-keygen -t ed25519 -C "uswege@miracore.com" -f ~/.ssh/id_ed25519 -N ""
fi

# Add GitHub to known hosts
if ! grep -q "github.com" ~/.ssh/known_hosts 2>/dev/null; then
    echo "🔗 Adding GitHub to known hosts..."
    ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null
fi

# Display public key for GitHub
echo ""
echo "🔑 GitHub SSH Public Key (add this to GitHub repository settings):"
echo "-------------------------------------------------------------------"
cat ~/.ssh/id_ed25519.pub
echo "-------------------------------------------------------------------"
echo ""

# Test GitHub connection
echo "🧪 Testing GitHub SSH connection..."
ssh -T git@github.com 2>&1 | head -n 3
EOF
}

# Main execution
main() {
    echo "🚀 Starting SSH key setup process..."
    echo ""
    
    # Step 1: Generate local SSH keys if needed
    echo "STEP 1: Generate SSH Keys"
    echo "------------------------"
    generate_ssh_key "miracore_prod" "uswege@miracore.com"
    generate_ssh_key "miracore_admin" "uswege@miracore.com"
    echo ""
    
    # Step 2: Copy keys to servers
    echo "STEP 2: Copy SSH Keys to Servers"
    echo "--------------------------------"
    
    echo "📤 Production Server ($PROD_SERVER):"
    if copy_ssh_key "miracore_prod" "$PROD_SERVER" "$USER"; then
        test_ssh_connection "$PROD_SERVER" "$USER"
    fi
    echo ""
    
    echo "📤 Admin Server ($ADMIN_SERVER):"
    if copy_ssh_key "miracore_admin" "$ADMIN_SERVER" "$USER"; then
        test_ssh_connection "$ADMIN_SERVER" "$USER"
    fi
    echo ""
    
    # Step 3: Setup GitHub SSH on servers
    echo "STEP 3: Setup GitHub SSH Access"
    echo "-------------------------------"
    
    if test_ssh_connection "$PROD_SERVER" "$USER"; then
        echo "🔧 Production Server GitHub Setup:"
        setup_github_ssh "$PROD_SERVER" "$USER"
        echo ""
    fi
    
    if test_ssh_connection "$ADMIN_SERVER" "$USER"; then
        echo "🔧 Admin Server GitHub Setup:"
        setup_github_ssh "$ADMIN_SERVER" "$USER"
        echo ""
    fi
    
    # Step 4: Create SSH config
    echo "STEP 4: Create SSH Config"
    echo "------------------------"
    
    cat > ~/.ssh/config << EOF
# MiraCore Production Server
Host miracore-prod
    HostName $PROD_SERVER
    User $USER
    IdentityFile ~/.ssh/miracore_prod
    IdentitiesOnly yes

# MiraCore Admin Server
Host miracore-admin
    HostName $ADMIN_SERVER
    User $USER
    IdentityFile ~/.ssh/miracore_admin
    IdentitiesOnly yes

# GitHub
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
EOF
    
    echo "✅ SSH config created at ~/.ssh/config"
    echo ""
    
    # Step 5: Final tests
    echo "STEP 5: Final Connection Tests"
    echo "-----------------------------"
    
    echo "🧪 Testing production server connection:"
    if ssh miracore-prod 'hostname && date'; then
        echo "✅ Production server connection successful"
    else
        echo "❌ Production server connection failed"
    fi
    echo ""
    
    echo "🧪 Testing admin server connection:"
    if ssh miracore-admin 'hostname && date'; then
        echo "✅ Admin server connection successful"
    else
        echo "❌ Admin server connection failed"
    fi
    echo ""
    
    # Summary
    echo "📋 SETUP COMPLETE"
    echo "================"
    echo ""
    echo "✅ SSH keys generated and configured"
    echo "✅ Server access configured"
    echo "⚠️  GitHub SSH keys generated (add public keys to GitHub repo settings)"
    echo ""
    echo "🔧 Usage Commands:"
    echo "   ssh miracore-prod     # Connect to production server"
    echo "   ssh miracore-admin    # Connect to admin server"
    echo ""
    echo "🐙 GitHub Setup:"
    echo "   1. Copy the GitHub SSH public keys shown above"
    echo "   2. Add them to GitHub repository settings"
    echo "   3. Test with: ssh -T git@github.com"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Add SSH public keys to GitHub repository"
    echo "   2. Run deployment: ssh miracore-prod 'cd /home/uswege/ess && git pull origin main'"
    echo "   3. Restart services: ssh miracore-prod 'cd /home/uswege/ess && pm2 restart all'"
    echo ""
}

# Run main function
main