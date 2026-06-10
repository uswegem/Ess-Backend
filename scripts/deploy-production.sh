#!/bin/bash

# ESS Production Deployment Script
# This script handles the deployment of the ESS application to production

set -e  # Exit on any error

# Configuration
PRODUCTION_SERVER="135.181.33.13"
PRODUCTION_USER="uswege"
PRODUCTION_PATH="/home/uswege/ess"
BACKUP_PATH="/home/uswege/backups"
HEALTH_ENDPOINT="http://localhost:3002/health"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to create backup
create_backup() {
    log "Creating backup of current deployment..."
    ssh ${PRODUCTION_USER}@${PRODUCTION_SERVER} "
        mkdir -p ${BACKUP_PATH}
        if [ -d ${PRODUCTION_PATH} ]; then
            tar -czf ${BACKUP_PATH}/ess-backup-\$(date +%Y%m%d_%H%M%S).tar.gz -C \$(dirname ${PRODUCTION_PATH}) \$(basename ${PRODUCTION_PATH})
            success 'Backup created successfully'
        else
            warning 'No existing deployment to backup'
        fi
    "
}

# Function to deploy application
deploy_application() {
    log "Deploying application to production..."
    
    # Create deployment package locally
    log "Creating deployment package..."
    tar -czf /tmp/ess-deployment.tar.gz \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='.github' \
        --exclude='*.log' \
        --exclude='logs/*' \
        --exclude='.env.local' \
        --exclude='deployment.tar.gz' \
        .
    
    # Copy to server
    log "Copying deployment package to server..."
    scp /tmp/ess-deployment.tar.gz ${PRODUCTION_USER}@${PRODUCTION_SERVER}:/tmp/
    
    # Deploy on server
    log "Extracting and installing on server..."
    ssh ${PRODUCTION_USER}@${PRODUCTION_SERVER} "
        set -e
        
        # Ensure directory exists
        mkdir -p ${PRODUCTION_PATH}
        
        # Extract deployment
        cd ${PRODUCTION_PATH}
        tar -xzf /tmp/ess-deployment.tar.gz
        
        # Install dependencies
        npm install --production --silent
        
        # Set permissions
        chmod +x *.js
        
        # Clean up
        rm /tmp/ess-deployment.tar.gz
    "
    
    # Clean up local deployment package
    rm /tmp/ess-deployment.tar.gz
}

# Function to restart services
restart_services() {
    log "Restarting PM2 services..."
    ssh ${PRODUCTION_USER}@${PRODUCTION_SERVER} "
        cd ${PRODUCTION_PATH}
        
        # Check if PM2 is running
        if pm2 list | grep -q 'ess-app'; then
            pm2 restart all
        else
            # Start services if not running
            pm2 start ecosystem.config.js
            pm2 save
        fi
        
        # Enable PM2 startup
        pm2 startup || true
    "
}

# Function to verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Wait for services to start
    sleep 10
    
    ssh ${PRODUCTION_USER}@${PRODUCTION_SERVER} "
        # Check if services are running
        pm2 list
        
        # Health check
        for i in {1..5}; do
            if curl -f ${HEALTH_ENDPOINT} > /dev/null 2>&1; then
                success 'Health check passed'
                break
            else
                warning \"Health check attempt \$i failed, retrying...\"
                sleep 5
            fi
            
            if [ \$i -eq 5 ]; then
                error 'Health check failed after 5 attempts'
                exit 1
            fi
        done
        
        # Check PM2 status
        if pm2 list | grep -q 'online'; then
            success 'PM2 services are running'
        else
            error 'PM2 services are not running properly'
            exit 1
        fi
    "
}

# Function to rollback deployment
rollback_deployment() {
    error "Deployment failed, initiating rollback..."
    
    ssh ${PRODUCTION_USER}@${PRODUCTION_SERVER} "
        cd ${BACKUP_PATH}
        
        # Find latest backup
        LATEST_BACKUP=\$(ls -t ess-backup-*.tar.gz 2>/dev/null | head -n1)
        
        if [ -n \"\$LATEST_BACKUP\" ]; then
            log \"Rolling back to \$LATEST_BACKUP\"
            
            # Remove failed deployment
            rm -rf ${PRODUCTION_PATH}
            
            # Restore from backup
            mkdir -p \$(dirname ${PRODUCTION_PATH})
            tar -xzf \$LATEST_BACKUP -C \$(dirname ${PRODUCTION_PATH})
            
            # Restart services
            cd ${PRODUCTION_PATH}
            pm2 restart all
            
            success 'Rollback completed'
        else
            error 'No backup found for rollback'
        fi
    "
}

# Main deployment function
main() {
    log "Starting ESS Production Deployment"
    log "Target: ${PRODUCTION_USER}@${PRODUCTION_SERVER}:${PRODUCTION_PATH}"
    
    # Check if we can connect to the server
    if ! ssh -o ConnectTimeout=10 ${PRODUCTION_USER}@${PRODUCTION_SERVER} "echo 'Connection test successful'" > /dev/null; then
        error "Cannot connect to production server"
        exit 1
    fi
    
    # Start deployment process
    create_backup
    deploy_application
    restart_services
    
    # Verify deployment
    if verify_deployment; then
        success "🎉 Deployment completed successfully!"
        
        # Display deployment info
        ssh ${PRODUCTION_USER}@${PRODUCTION_SERVER} "
            echo '📊 Deployment Information:'
            echo '  Server: ${PRODUCTION_SERVER}'
            echo '  Path: ${PRODUCTION_PATH}'
            echo '  Time: \$(date)'
            echo '  PM2 Status:'
            pm2 list --no-color
        "
    else
        rollback_deployment
        exit 1
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi