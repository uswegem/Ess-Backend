
// Admin-specific routes for MiraAdmin frontend compatibility
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const UserController = require('../controllers/userController');
const AuditController = require('../controllers/auditController');
const LoanMappingService = require('../services/loanMappingService');
const { authMiddleware, roleMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');
const outgoingMessagesController = require('../controllers/outgoingMessagesController');
const loanStatusController = require('../controllers/loanStatusController');
const logger = require('../utils/logger');

// Authentication routes
router.post('/auth/login', AuthController.login);
router.get('/auth/profile', authMiddleware, AuthController.getProfile);
router.post('/auth/logout', authMiddleware, AuthController.logout);

// Product/Loan routes
/**
 * @swagger
 * /api/v1/loan/list-products:
 *   get:
 *     summary: List products (admin compat)
 *     description: Tenant-scoped active products for MiraAdmin frontend (M3).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Formatted product list
 */
router.get('/loan/list-products', authMiddleware, async (req, res) => {
    try {
        const Product = require('../models/Product');
        const { buildTenantListQuery } = require('../utils/tenantQuery');
        // Excludes draft products (saved via "Save Draft" but not yet finalized) from the
        // main product list - they're only visible via the Drafts view. $ne (not exact-match
        // 'active') so products predating the status field, which have no status set at all,
        // still show up here rather than silently vanishing. Deliberately NOT filtering on
        // isActive - decommissioned/soft-deleted products must still show (with a
        // "Decommissioned" status) so the operator can see the full catalog, not just live ones.
        const productQuery = req.tenant?.tenantId
          ? buildTenantListQuery(req.tenant.tenantId, { status: { $ne: 'draft' } })
          : { status: { $ne: 'draft' } };
        const products = await Product.find(productQuery)
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
                utumishiSyncStatus: 1,
                lastSubmitError: 1,
                status: 1,
                isActive: 1,
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
            mifosProductId: p.mifosProductId,
            utumishiSyncStatus: p.utumishiSyncStatus || 'NOT_SUBMITTED',
            lastSubmitError: p.lastSubmitError,
            status: p.status || 'active',
            isActive: p.isActive
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

/**
 * @swagger
 * /api/v1/loan/list-employee-loan:
 *   get:
 *     summary: List employee loans (admin compat)
 *     description: Tenant-scoped loan mappings with details (M3).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loan list
 */
// Shared filter-building for both the JSON listing and its PDF export below, so the two
// can never drift out of sync on what counts as "currently filtered" - see Loan.js's
// Export PDF button, which sends this same param set to get an identical result set.
function buildLoanListParams(req) {
    const { status, search, page, limit, excludeStatuses, startDate, endDate } = req.query;
    return {
        tenantId: req.tenant?.tenantId || null,
        status,
        // Opt-in only: shared with the general /loan page, which never sends this param,
        // so its results are unaffected. The message-trigger loan lookup sends it explicitly
        // to exclude CHARGES_CALCULATED loans (no LOAN_OFFER_REQUEST received yet, so no
        // outgoing message would be meaningful to trigger for them).
        excludeStatuses,
        // Single unified search box - see getAllWithDetails() in loanMappingService.js for
        // the full field list this matches against (application #, check #, client name
        // parts, MIFOS loan ID/account).
        search,
        startDate,
        endDate,
        page,
        // Default kept high (rather than the service's default of 20) so callers that
        // don't paginate (e.g. the message-trigger loan lookup) still get the full list.
        limit: limit || 500
    };
}

router.get('/loan/list-employee-loan', authMiddleware, async (req, res) => {
    try {
        const loans = await LoanMappingService.getAllWithDetails(buildLoanListParams(req));
        res.json({
            success: true,
            data: { loans }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @swagger
 * /api/v1/loan/list-employee-loan/export/pdf:
 *   get:
 *     summary: PDF export of the Loan Management table, respecting current filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf: {}
 */
router.get('/loan/list-employee-loan/export/pdf', authMiddleware, async (req, res) => {
    try {
        const loans = await LoanMappingService.getAllWithDetails(buildLoanListParams(req));
        const pdfGeneratorService = require('../services/pdfGeneratorService');

        const columns = [
            { field: 'essApplicationNumber', headerName: 'Application #' },
            { field: 'productCode', headerName: 'Product' },
            { field: 'clientName', headerName: 'Client' },
            { field: 'requestedAmount', headerName: 'Amount' },
            { field: 'tenure', headerName: 'Tenure (mo)' },
            { field: 'status', headerName: 'Status' },
            { field: 'createdAt', headerName: 'Created' },
            { field: 'mifosLoanId', headerName: 'MIFOS Loan ID' },
        ];
        const rows = loans.map((loan) => ({
            essApplicationNumber: loan.essApplicationNumber,
            productCode: loan.productCode,
            // getAllWithDetails() already extracts metadata.clientData to a top-level
            // `clientData` field (see loanMappingService.js) - matches Loan.js's own
            // clientDisplayName() helper exactly, so the PDF and the on-screen table never
            // show a different name for the same loan.
            clientName: [loan.clientData?.firstName, loan.clientData?.middleName, loan.clientData?.lastName]
                .filter(Boolean).join(' ') || loan.clientData?.checkNumber || '—',
            requestedAmount: loan.requestedAmount,
            tenure: loan.tenure,
            status: loan.status,
            createdAt: loan.createdAt ? new Date(loan.createdAt).toLocaleString() : '—',
            mifosLoanId: loan.mifosLoanId || '—',
        }));

        const { startDate, endDate } = req.query;
        const subtitle = (startDate || endDate) ? `${startDate || '…'} to ${endDate || '…'}` : undefined;

        const pdfBuffer = await pdfGeneratorService.generateTablePdf('Loan Management', subtitle, columns, rows);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="loans-${Date.now()}.pdf"`
        });
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/loan/:id', authMiddleware, async (req, res) => {
    try {
        const loan = await LoanMappingService.getById(req.params.id, req.tenant?.tenantId || null);
        if (!loan) {
            return res.status(404).json({ success: false, message: 'Loan not found' });
        }
        res.json({ success: true, data: { loan } });
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
        const Notification = require('../models/Notification');
        const { buildTenantListQuery } = require('../utils/tenantQuery');
        let notifications = [];

        try {
            const filter = buildTenantListQuery(req.tenant?.tenantId || null);
            notifications = await Notification.find(filter)
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();
        } catch (e) {
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
        const { buildTenantListQuery } = require('../utils/tenantQuery');
        const filter = buildTenantListQuery(req.tenant?.tenantId || null, { _id: req.params.id });
        const updated = await Notification.findOneAndUpdate(filter, { read: true });
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Pending responses routes (for message tracking)
router.get('/messages/pending-responses', authMiddleware, async (req, res) => {
    try {
        const MessageLog = require('../models/MessageLog');
        const { buildTenantQuery } = require('../utils/tenantQuery');
        let pendingResponses = [];

        try {
            let filter = { status: { $in: ['pending', 'failed'] } };
            if (req.tenant?.tenantId) {
                filter = buildTenantQuery(req.tenant.tenantId, filter);
            }
            pendingResponses = await MessageLog.find(filter)
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

// Manual message triggers (used by the "Message Triggers" page in the admin
// portal). Tenant-scoped and permission-gated - see loanStatusController and
// outgoingMessagesController for the elevated 'messages:trigger_sensitive'
// check on money-movement/loan-finality message types.
router.post('/outgoing-message', authMiddleware, permissionMiddleware('messages:trigger'), outgoingMessagesController.triggerOutgoingMessage);
// Pre-submit check only - same base permission as the send route above, not the elevated
// 'messages:trigger_sensitive' (see outgoingMessagesController.validateOutgoingMessage).
router.post('/outgoing-message/validate', authMiddleware, permissionMiddleware('messages:trigger'), outgoingMessagesController.validateOutgoingMessage);
router.post('/loan-status-request', authMiddleware, permissionMiddleware('messages:trigger'), loanStatusController.triggerLoanStatusRequest);

module.exports = router;
