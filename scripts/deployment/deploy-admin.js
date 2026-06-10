#!/usr/bin/env node

/**
 * MiraAdmin Portal Deployment Script
 * Automates the complete deployment of the admin portal
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration from .env
const config = {
    adminServer: process.env.ADMIN_REMOTE_SERVER || '5.75.185.137',
    adminUser: process.env.ADMIN_REMOTE_USER || 'uswege',
    adminPath: process.env.ADMIN_REMOTE_PATH || '/opt/middleware/MiraAdmin',
    webPath: process.env.ADMIN_WEB_PATH || '/var/www/html/admin',
    apiPort: process.env.ADMIN_API_PORT || '3002',
    githubUrl: process.env.ADMIN_GITHUB_URL || 'https://github.com/uswegem/MiraCoreAdmin'
};

function executeCommand(command, description) {
    console.log(`\n🔄 ${description}...`);
    try {
        const output = execSync(command, { encoding: 'utf8', stdio: 'inherit' });
        console.log(`✅ ${description} completed`);
        return output;
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        throw error;
    }
}

async function deployAdmin() {
    console.log('🚀 Starting MiraAdmin Portal Deployment...\n');
    
    try {
        // 1. Update ESS backend with admin routes
        console.log('📦 Adding admin routes to ESS backend...');
        await addAdminRoutes();
        
        // 2. Deploy frontend to admin server
        const sshPrefix = `ssh ${config.adminUser}@${config.adminServer}`;
        
        // Backup existing installation
        executeCommand(
            `${sshPrefix} "cd /opt/middleware && mv MiraAdmin MiraAdmin_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo 'No backup needed'"`,
            'Backing up existing installation'
        );
        
        // Clone and setup
        executeCommand(
            `${sshPrefix} "cd /opt/middleware && git clone ${config.githubUrl} MiraAdmin"`,
            'Cloning MiraAdmin repository'
        );
        
        // Configure environment
        executeCommand(
            `${sshPrefix} "cd ${config.adminPath} && echo 'REACT_APP_API_V1_BASE_URL=http://${config.adminServer}/api/v1' > .env"`,
            'Configuring environment variables'
        );
        
        // Install dependencies and build
        executeCommand(
            `${sshPrefix} "cd ${config.adminPath} && npm install"`,
            'Installing frontend dependencies'
        );
        
        executeCommand(
            `${sshPrefix} "cd ${config.adminPath} && npm run build"`,
            'Building React application'
        );
        
        // Deploy build
        executeCommand(
            `${sshPrefix} "sudo cp -r ${config.adminPath}/build/* ${config.webPath}/"`,
            'Deploying build to web directory'
        );
        
        // Restart services
        executeCommand(
            `ssh uswege@135.181.33.13 "cd /home/uswege/ess && pm2 restart all"`,
            'Restarting ESS backend services'
        );
        
        console.log('\n🎉 MiraAdmin Portal deployed successfully!');
        console.log(`📱 Admin Portal: http://${config.adminServer}/`);
        console.log(`🔗 API Backend: http://135.181.33.13:${config.apiPort}/api/v1`);
        console.log(`📊 Grafana: http://${config.adminServer}:3000/`);
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

async function addAdminRoutes() {
    // Add admin-specific API routes to the ESS backend
    const adminRoutesContent = `
// Admin-specific routes for MiraAdmin frontend compatibility
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const UserController = require('../controllers/userController');
const AuditController = require('../controllers/auditController');
const LoanMappingService = require('../services/loanMappingService');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// Authentication routes
router.post('/auth/login', AuthController.login);
router.get('/auth/profile', authMiddleware, AuthController.getProfile);
router.post('/auth/logout', authMiddleware, AuthController.logout);

// Product/Loan routes
router.get('/loan/list-products', authMiddleware, async (req, res) => {
    try {
        // Return loan products from CBS or mock data
        res.json({
            success: true,
            data: {
                products: [
                    { id: 1, name: 'Personal Loan', rate: 12.5, maxAmount: 1000000 },
                    { id: 2, name: 'Business Loan', rate: 15.0, maxAmount: 5000000 }
                ]
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/loan/list-employee-loan', authMiddleware, async (req, res) => {
    try {
        const loans = await LoanMappingService.getAllWithDetails();
        res.json({
            success: true,
            data: { loans }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin user management (compatible with existing routes)
router.get('/admin/get_all_users', authMiddleware, roleMiddleware(['super_admin', 'admin']), UserController.getUsers);
router.get('/admin/get_user_details/:id', authMiddleware, roleMiddleware(['super_admin', 'admin']), UserController.getUserById);
router.delete('/admin/delete_user/:id', authMiddleware, roleMiddleware(['super_admin', 'admin']), UserController.deleteUser);

// Admin profile routes
router.get('/admin/get_admin', authMiddleware, AuthController.getProfile);
router.put('/admin/edit_admin', authMiddleware, UserController.updateUser);
router.post('/admin/change_password', authMiddleware, AuthController.changePassword);

module.exports = router;
`;

    // Write admin routes file
    fs.writeFileSync(path.join(__dirname, 'src', 'routes', 'adminCompat.js'), adminRoutesContent);
    
    // Update server.js to include admin routes
    const serverPath = path.join(__dirname, 'server.js');
    let serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Add admin routes import
    if (!serverContent.includes('adminCompatRoutes')) {
        const importSection = "const auditRoutes = require('./src/routes/audit');";
        const newImport = importSection + "\nconst adminCompatRoutes = require('./src/routes/adminCompat');";
        serverContent = serverContent.replace(importSection, newImport);
    }
    
    // Add admin routes usage
    if (!serverContent.includes('/api/v1/admin')) {
        const routeSection = "app.use('/api/v1/audit', auditRoutes);";
        const newRoute = routeSection + "\n\n// Admin compatibility routes for MiraAdmin frontend\napp.use('/api/v1', adminCompatRoutes);";
        serverContent = serverContent.replace(routeSection, newRoute);
    }
    
    fs.writeFileSync(serverPath, serverContent);
    console.log('✅ Added admin compatibility routes to ESS backend');
}

// Run deployment
if (require.main === module) {
    deployAdmin();
}

module.exports = { deployAdmin };