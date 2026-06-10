# GitHub Workflow Setup Guide

## Overview
The GitHub Actions workflow has been optimized for automated deployment to the production server.

## What was Fixed

### 1. **Environment Variables**
- Added consistent environment variables to avoid hardcoded values
- `REMOTE_HOST`: 135.181.33.13  
- `REMOTE_USER`: uswege
- `REMOTE_PATH`: /home/uswege/ess

### 2. **Improved Health Checks**
- Multiple health check endpoints (fallback options)
- Better error reporting when deployment fails
- Port availability checking as backup validation

### 3. **Error Handling**
- More robust SSH connections
- Better backup and restore mechanisms
- Detailed logging for troubleshooting

### 4. **Security**
- Proper SSH key handling
- Secure file permissions
- Environment configuration backup/restore

## Required GitHub Secrets

### SSH_PRIVATE_KEY
The private SSH key for accessing the production server.

**To get your SSH key:**
```bash
# If you already have a key
cat ~/.ssh/id_rsa

# If you need to generate a new key
ssh-keygen -t rsa -b 4096 -C "github-actions@miracore"
```

**To add the public key to the server:**
```bash
ssh-copy-id uswege@135.181.33.13
```

## Setup Instructions

### Option 1: Automated Setup (Linux/Mac)
```bash
chmod +x setup-github-secrets.sh
./setup-github-secrets.sh
```

### Option 2: Manual Setup
1. Go to: https://github.com/uswegem/MiraCore_New/settings/secrets/actions
2. Click "New repository secret"
3. Name: `SSH_PRIVATE_KEY`
4. Value: Your SSH private key content (including BEGIN/END lines)

## Testing the Workflow

### 1. Manual Trigger
- Go to Actions tab in GitHub
- Select "Deploy to Production" workflow  
- Click "Run workflow"

### 2. Automatic Trigger
- Push changes to `main` branch
- Workflow will automatically start

### 3. Monitor Deployment
- Watch the workflow progress in GitHub Actions
- Check server logs: `ssh uswege@135.181.33.13 "pm2 logs ess-app"`

## Workflow Stages

1. **Test**: Run unit tests and simulations
2. **Security Scan**: Check for vulnerabilities  
3. **Deploy**: 
   - Create backup
   - Deploy code
   - Install dependencies
   - Restart PM2 service
   - Perform health checks
   - Verify deployment

## Troubleshooting

### SSH Connection Issues
```bash
# Test SSH connection manually
ssh uswege@135.181.33.13 "echo 'Connection successful'"

# Check SSH key format
head -1 ~/.ssh/id_rsa  # Should be -----BEGIN OPENSSH PRIVATE KEY-----
```

### Health Check Failures  
```bash
# Check if service is running
ssh uswege@135.181.33.13 "pm2 list"

# Check port availability
ssh uswege@135.181.33.13 "netstat -tlnp | grep :3002"

# Check logs
ssh uswege@135.181.33.13 "tail -50 /home/uswege/ess/logs/app-$(date +%Y-%m-%d).log"
```

### PM2 Process Issues
```bash
# Restart PM2 manually
ssh uswege@135.181.33.13 "cd /home/uswege/ess && pm2 restart ecosystem.config.js"

# Check PM2 status
ssh uswege@135.181.33.13 "pm2 status"
```

## Success Verification

After successful deployment:
- ✅ GitHub Actions workflow shows all green checkmarks
- ✅ Health endpoint responds: `curl http://135.181.33.13:3002/health`
- ✅ PM2 shows processes running: `pm2 list`
- ✅ Application logs show no errors

## Next Steps

1. Set up the SSH_PRIVATE_KEY secret
2. Test the deployment workflow
3. Monitor the first deployment closely
4. Set up additional monitoring/alerting as needed

The workflow is now optimized for reliable, automated deployments! 🚀