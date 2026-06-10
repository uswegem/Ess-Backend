# GitHub Secret Setup Instructions

## Quick Setup

The GitHub Actions workflow requires an SSH private key to deploy to the production server.

### Step 1: Get Your SSH Private Key

On Windows (Git Bash or PowerShell):
```bash
cat ~/.ssh/id_rsa
```

Copy the **entire output** including:
- `-----BEGIN OPENSSH PRIVATE KEY-----`
- All the key content
- `-----END OPENSSH PRIVATE KEY-----`

### Step 2: Add Secret to GitHub

1. Go to: https://github.com/uswegem/MiraCore_New/settings/secrets/actions

2. Click **"New repository secret"**

3. Name: `SSH_PRIVATE_KEY`

4. Value: Paste the entire private key content from Step 1

5. Click **"Add secret"**

### Step 3: Verify Deployment

1. Push changes to trigger workflow:
   ```bash
   git push origin main
   ```

2. Monitor deployment:
   - Go to: https://github.com/uswegem/MiraCore_New/actions
   - Click on the latest workflow run
   - Watch the deployment progress

## Alternative: Use GitHub CLI

If you have GitHub CLI installed:

```bash
# Login to GitHub CLI
gh auth login

# Set the SSH private key secret
cat ~/.ssh/id_rsa | gh secret set SSH_PRIVATE_KEY --repo uswegem/MiraCore_New

# Verify secret was added
gh secret list --repo uswegem/MiraCore_New
```

## Troubleshooting

### SSH Key Not Found?
Generate a new SSH key:
```bash
ssh-keygen -t ed25519 -C "github-actions@miracore"
```

Then add the public key to the server:
```bash
ssh-copy-id uswege@135.181.33.13
```

### Workflow Fails at SSH Setup?
- Ensure the private key is correctly formatted (no extra spaces/newlines)
- Verify the public key is in `~/.ssh/authorized_keys` on the server
- Check server firewall allows SSH connections

### Deployment Hangs?
- Verify PM2 is installed on the server: `pm2 --version`
- Check server disk space: `df -h`
- Review logs: `pm2 logs ess-app`

## Current Status

✅ Code pushed to GitHub: commit `91060ac`  
⏳ Waiting for SSH secret configuration  
📍 Deployment will automatically trigger once secret is added
