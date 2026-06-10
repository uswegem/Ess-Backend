# GitHub Authentication Setup for CI/CD

## Server SSH Key for GitHub Access

The production server needs to authenticate with GitHub to pull code updates.

### Server Public SSH Key
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICKwaRyTJJntyb9rExXPmdq0hez/P8OxTy+eay7Ial0p uswege@miracore.com
```

## Setup Steps

### Option 1: Add Deploy Key to GitHub Repository (Recommended for CI/CD)

1. Go to: https://github.com/uswegem/MiraCore_New/settings/keys
2. Click **"Add deploy key"**
3. Title: `Production Server - 135.181.33.13`
4. Key: Paste the SSH key above
5. ✅ Check **"Allow write access"** (needed for automated deployments)
6. Click **"Add key"**

### Option 2: Add to Personal SSH Keys (If you want server to access all your repos)

1. Go to: https://github.com/settings/keys
2. Click **"New SSH key"**
3. Title: `MiraCore Production Server`
4. Key: Paste the SSH key above
5. Click **"Add SSH key"**

## Verify Setup

After adding the key, test the connection from the production server:

```bash
ssh uswege@135.181.33.13 "ssh -T git@github.com"
```

Expected output:
```
Hi uswegem! You've successfully authenticated, but GitHub does not provide shell access.
```

## Update GitHub Actions Workflow

The workflow also needs SSH access. Ensure the `SSH_PRIVATE_KEY` secret is set:

### Get the Private Key

```bash
ssh uswege@135.181.33.13 "cat ~/.ssh/id_ed25519"
```

### Add to GitHub Secrets

1. Go to: https://github.com/uswegem/MiraCore_New/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `SSH_PRIVATE_KEY`
4. Value: Paste the **ENTIRE** private key (including BEGIN and END lines)
5. Click **"Add secret"**

## Test Deployment

After setup, test by triggering a deployment:

```bash
# Make an empty commit to trigger workflow
git commit --allow-empty -m "test: Verify CI/CD authentication"
git push origin main
```

Monitor at: https://github.com/uswegem/MiraCore_New/actions

## Current Status

- ✅ Git remote changed from HTTPS to SSH
- ⏳ Waiting for SSH key to be added to GitHub
- ⏳ Waiting for GitHub Actions SSH_PRIVATE_KEY secret

## Troubleshooting

### If deployment still fails:

1. **Check SSH key is added**: Visit the GitHub settings links above
2. **Verify key format**: Private key must include full BEGIN/END lines
3. **Test manually**: Try `git pull` on the server after adding the key
4. **Check workflow logs**: Look for SSH connection errors in GitHub Actions

### Manual deployment (if CI/CD fails):

```bash
# From local machine
cd /c/laragon/www/ess
scp -r src/ uswege@135.181.33.13:/home/uswege/ess/
ssh uswege@135.181.33.13 "cd /home/uswege/ess && pm2 restart all"
```
