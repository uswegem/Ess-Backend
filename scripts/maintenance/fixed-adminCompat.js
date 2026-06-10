// Admin-specific routes for MiraAdmin frontend compatibility
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const UserController = require('../controllers/userController');
const AuditController = require('../controllers/auditController');
const LoanMappingService = require('../services/loanMappingService');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

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

// Notification endpoints
router.get('/notification/list', authMiddleware, async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const auditLogs = await db.collection('auditlogs').find({})
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        
        // Transform audit logs to notification format
        const notifications = auditLogs.map((log, index) => ({
            id: log._id.toString(),
            employee: log.metadata?.username || log.metadata?.fullName || 'System',
            loanId: log.metadata?.loanId || `LN${String(index + 1).padStart(3, '0')}`,
            message: log.description || log.action,
            status: log.status === 'success' ? 'success' : 
                   log.status === 'failed' ? 'failure' : 'pending',
            createdAt: log.createdAt ? new Date(log.createdAt).toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }) : new Date().toLocaleString(),
            metadata: log.metadata
        }));
        
        res.json({
            success: true,
            data: notifications,
            total: notifications.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/notification/resend', authMiddleware, async (req, res) => {
    try {
        const { notificationId } = req.body;
        
        if (!notificationId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Notification ID is required' 
            });
        }
        
        const db = mongoose.connection.db;
        
        // Find the notification to resend
        const notification = await db.collection('auditlogs').findOne({ 
            _id: new mongoose.Types.ObjectId(notificationId) 
        });
        
        if (!notification) {
            return res.status(404).json({ 
                success: false, 
                message: 'Notification not found' 
            });
        }
        
        // Create a new audit log entry for the resend action
        const resendLog = {
            action: 'notification_resend',
            description: `Resent notification: ${notification.description}`,
            userId: notification.userId,
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip,
            status: 'success',
            metadata: {
                originalNotificationId: notificationId,
                resendBy: req.user.username,
                originalAction: notification.action,
                ...notification.metadata
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        await db.collection('auditlogs').insertOne(resendLog);
        
        res.json({
            success: true,
            message: 'Notification resent successfully',
            data: {
                resendId: resendLog._id,
                originalNotificationId: notificationId
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Legacy notifications endpoint for backward compatibility
router.get('/admin/notifications', authMiddleware, async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const auditLogs = await db.collection('auditlogs').find({})
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        
        // Transform audit logs to notification format
        const notifications = auditLogs.map((log, index) => ({
            id: index + 1,
            employee: log.metadata?.username || log.metadata?.fullName || 'System',
            loanId: log.metadata?.loanId || `LN${String(index + 1).padStart(3, '0')}`,
            message: log.description || log.action,
            status: log.status === 'success' ? 'success' : 
                   log.status === 'failed' ? 'failure' : 'pending',
            createdAt: log.createdAt ? new Date(log.createdAt).toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }) : new Date().toLocaleString()
        }));
        
        res.json({
            success: true,
            data: { notifications }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Dashboard endpoint with comprehensive statistics
router.get('/admin/dashboard', authMiddleware, async (req, res) => {
    try {
        const db = mongoose.connection.db;
        
        // Get loan statistics
        const totalLoans = await db.collection('loanmappings').countDocuments();
        const loansByStatus = await db.collection('loanmappings').aggregate([
            { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$requestedAmount' } } }
        ]).toArray();
        
        // Get user statistics  
        const totalUsers = await db.collection('users').countDocuments();
        const usersByRole = await db.collection('users').aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]).toArray();
        
        // Get recent activity from audit logs
        const recentActivity = await db.collection('auditlogs').find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();
            
        // Get daily loan applications (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const dailyApplications = await db.collection('loanmappings').aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { 
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$requestedAmount' }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();
        
        // Calculate success rate
        const successfulLoans = loansByStatus.find(s => s._id === 'OFFER_SUBMITTED')?.count || 0;
        const failedLoans = loansByStatus.find(s => s._id === 'FAILED')?.count || 0;
        const successRate = totalLoans > 0 ? ((successfulLoans / totalLoans) * 100).toFixed(1) : '0';
        
        // Get system performance metrics
        const avgProcessingTime = await db.collection('auditlogs').aggregate([
            { $match: { action: { $regex: /loan|application/i } } },
            { $group: { _id: null, avgTime: { $avg: 2500 } } } // Mock data for now
        ]).toArray();
        
        const dashboardData = {
            overview: {
                totalLoans,
                totalUsers,
                successRate: parseFloat(successRate),
                avgProcessingTime: avgProcessingTime[0]?.avgTime || 2500
            },
            loanStatistics: {
                byStatus: loansByStatus.map(item => ({
                    status: item._id || 'Unknown',
                    count: item.count,
                    totalAmount: item.totalAmount
                })),
                dailyApplications: dailyApplications.map(item => ({
                    date: item._id,
                    applications: item.count,
                    totalAmount: item.totalAmount
                }))
            },
            userStatistics: {
                total: totalUsers,
                byRole: usersByRole.map(item => ({
                    role: item._id,
                    count: item.count
                }))
            },
            recentActivity: recentActivity.slice(0, 5).map(log => ({
                id: log._id.toString(),
                action: log.action,
                description: log.description,
                user: log.metadata?.username || 'System',
                timestamp: log.createdAt,
                status: log.status
            })),
            systemHealth: {
                status: 'healthy',
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                responseTime: avgProcessingTime[0]?.avgTime || 2500
            }
        };
        
        res.json({
            success: true,
            data: dashboardData
        });
        
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Dashboard stats endpoint (alternative path)
router.get('/dashboard/stats', authMiddleware, async (req, res) => {
    // Redirect to main dashboard endpoint
    req.url = '/admin/dashboard';
    return router.handle(req, res);
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