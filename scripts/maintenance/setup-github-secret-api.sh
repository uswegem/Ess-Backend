#!/bin/bash

# Script to set GitHub secret using API
# Requires: jq, libsodium (for encryption)

REPO_OWNER="uswegem"
REPO_NAME="MiraCore_New"
SECRET_NAME="SSH_PRIVATE_KEY"

echo "🔐 Setting up GitHub Secret: $SECRET_NAME"
echo ""

# Check for required tools
if ! command -v jq &> /dev/null; then
    echo "❌ jq is not installed. Install with: apt-get install jq"
    exit 1
fi

# Prompt for GitHub Personal Access Token
echo "📝 You need a GitHub Personal Access Token with 'repo' scope"
echo "Create one at: https://github.com/settings/tokens/new"
echo ""
read -sp "Enter your GitHub PAT: " GITHUB_TOKEN
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ No token provided"
    exit 1
fi

# Get SSH private key
echo ""
echo "📄 Enter path to SSH private key (default: ~/.ssh/id_rsa):"
read -r KEY_PATH
KEY_PATH=${KEY_PATH:-~/.ssh/id_rsa}

if [ ! -f "$KEY_PATH" ]; then
    echo "❌ SSH key not found at: $KEY_PATH"
    exit 1
fi

SSH_KEY=$(cat "$KEY_PATH")

echo ""
echo "🔍 Getting repository public key..."

# Get repo's public key for encrypting secrets
PUBLIC_KEY_RESPONSE=$(curl -s \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/public-key")

KEY_ID=$(echo "$PUBLIC_KEY_RESPONSE" | jq -r '.key_id')
PUBLIC_KEY=$(echo "$PUBLIC_KEY_RESPONSE" | jq -r '.key')

if [ "$KEY_ID" == "null" ]; then
    echo "❌ Failed to get repository public key. Check your token permissions."
    echo "Response: $PUBLIC_KEY_RESPONSE"
    exit 1
fi

echo "✅ Got public key: $KEY_ID"
echo ""

# For GitHub Actions secrets, we need to encrypt the value using libsodium
# This is complex in bash, so we'll use a Python helper script

echo "📝 Creating Python encryption helper..."

cat > /tmp/encrypt_secret.py << 'PYTHON_EOF'
import sys
import base64
from nacl import encoding, public

def encrypt_secret(public_key: str, secret_value: str) -> str:
    """Encrypt a secret using libsodium."""
    public_key_bytes = base64.b64decode(public_key)
    public_key_obj = public.PublicKey(public_key_bytes)
    sealed_box = public.SealedBox(public_key_obj)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python encrypt_secret.py <public_key> <secret_value>")
        sys.exit(1)
    
    public_key = sys.argv[1]
    secret_value = sys.argv[2]
    
    try:
        encrypted = encrypt_secret(public_key, secret_value)
        print(encrypted)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
PYTHON_EOF

echo "🔐 Encrypting secret..."

# Try to encrypt using Python with PyNaCl
if command -v python3 &> /dev/null; then
    # Install PyNaCl if not present
    python3 -c "import nacl" 2>/dev/null || {
        echo "📦 Installing PyNaCl..."
        python3 -m pip install PyNaCl --quiet
    }
    
    ENCRYPTED_VALUE=$(python3 /tmp/encrypt_secret.py "$PUBLIC_KEY" "$SSH_KEY")
    
    if [ $? -eq 0 ]; then
        echo "✅ Secret encrypted successfully"
        echo ""
        echo "📤 Uploading secret to GitHub..."
        
        # Upload the secret
        RESPONSE=$(curl -s -w "\n%{http_code}" \
          -X PUT \
          -H "Authorization: token $GITHUB_TOKEN" \
          -H "Accept: application/vnd.github.v3+json" \
          "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/$SECRET_NAME" \
          -d "{\"encrypted_value\":\"$ENCRYPTED_VALUE\",\"key_id\":\"$KEY_ID\"}")
        
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)
        
        if [ "$HTTP_CODE" == "201" ] || [ "$HTTP_CODE" == "204" ]; then
            echo "✅ Secret $SECRET_NAME uploaded successfully!"
            echo ""
            echo "🎉 Setup complete! You can now trigger the GitHub Actions workflow."
        else
            echo "❌ Failed to upload secret. HTTP $HTTP_CODE"
            echo "Response: $RESPONSE_BODY"
        fi
    else
        echo "❌ Failed to encrypt secret"
        exit 1
    fi
else
    echo "❌ Python 3 is required for secret encryption"
    echo ""
    echo "Manual setup required:"
    echo "1. Go to: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
    echo "2. Click 'New repository secret'"
    echo "3. Name: $SECRET_NAME"
    echo "4. Value: [paste your SSH private key]"
    exit 1
fi

# Cleanup
rm -f /tmp/encrypt_secret.py

echo ""
echo "📋 Next steps:"
echo "1. Verify secret at: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
echo "2. Push to trigger deployment: git push origin main"
echo "3. Monitor at: https://github.com/$REPO_OWNER/$REPO_NAME/actions"
