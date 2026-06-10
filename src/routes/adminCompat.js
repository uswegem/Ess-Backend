
// Admin-specific routes for MiraAdmin frontend compatibility
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const UserController = require('../controllers/userController');
const AuditController = require('../controllers/auditController');
const LoanMappingService = require('../services/loanMappingService');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// Authentication routes
router.post('/auth/login', AuthController.login);
router.get('/auth/profile', authMiddleware, AuthController.getProfile);
router.post('/auth/logout', authMiddleware, AuthController.logout);

// Product/Loan routes
router.get('/loan/list-products', authMiddleware, async (req, res) => {
    try {
        const Product = require('../models/Product');
        const products = await Product.find({ isActive: true })
            .select({
                _id: 1,
                productCode: 1,
                deductionCode: 1,
                productName: 1,
                productDescription: 1,
                minTenure: 1,
                maxTenure: 1,
                interestRate: 1,
                processingFee: 1,
                insurance: 1,
                minAmount: 1,
                maxAmount: 1,
                repaymentType: 1,
                insuranceType: 1,
                forExecutive: 1,
                shariaFacility: 1,
                termsConditions: 1,
                mifosProductId: 1,
                createdAt: 1
            })
            .sort({ createdAt: -1 })
            .lean();
        
        // Map to frontend expected format
        const formattedProducts = products.map(p => ({
            id: p._id,
            productCode: p.productCode,
            deductionCode: p.deductionCode,
            name: p.productName,
            productName: p.productName,
            description: p.productDescription,
            productDescription: p.productDescription,
            minTenure: p.minTenure,
            maxTenure: p.maxTenure,
            rate: p.interestRate,
            interestRate: p.interestRate,
            processingFee: p.processingFee,
            insurance: p.insurance,
            minAmount: p.minAmount,
            maxAmount: p.maxAmount,
            repaymentType: p.repaymentType,
            insuranceType: p.insuranceType,
            forExecutive: p.forExecutive,
            shariaFacility: p.shariaFacility,
            termsConditions: p.termsConditions || [],
            mifosProductId: p.mifosProductId
        }));
        
        res.json({
            success: true,
            data: {
                products: formattedProducts
            }
        });
    } catch (error) {
        logger.error('Error fetching products:', error);
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

// Create user endpoint (for MiraAdmin frontend)
router.post('/admin/create_user', authMiddleware, roleMiddleware(['super_admin', 'admin']), UserController.createUser);

// Update user endpoint
router.put('/admin/update_user/:id', authMiddleware, roleMiddleware(['super_admin', 'admin']), UserController.updateUser);

// Admin profile routes
router.get('/admin/get_admin', authMiddleware, AuthController.getProfile);
router.put('/admin/edit_admin', authMiddleware, UserController.updateUser);
router.post('/admin/change_password', authMiddleware, AuthController.changePassword);

// Notification routes (for MiraAdmin frontend)
router.get('/notification/list', authMiddleware, async (req, res) => {
    try {
        // Return notifications from database or empty list
        const Notification = require('../models/Notification');
        let notifications = [];
        
        try {
            notifications = await Notification.find()
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();
        } catch (e) {
            // Model may not exist yet, return empty list
            notifications = [];
        }
        
        res.json({
            success: true,
            data: { notifications }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mark notification as read
router.put('/notification/read/:id', authMiddleware, async (req, res) => {
    try {
        const Notification = require('../models/Notification');
        await Notification.findByIdAndUpdate(req.params.id, { read: true });
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Pending responses routes (for message tracking)
router.get('/messages/pending-responses', authMiddleware, async (req, res) => {
    try {
        const MessageLog = require('../models/MessageLog');
        let pendingResponses = [];
        
        try {
            pendingResponses = await MessageLog.find({
                status: { $in: ['PENDING', 'AWAITING_RESPONSE'] }
            })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        } catch (e) {
            // Model may not exist, return empty list
            pendingResponses = [];
        }
        
        res.json({
            success: true,
            data: { pendingResponses }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
