const express = require('express');
const router = express.Router();
const TenantController = require('../controllers/tenantController');
const TenantUserController = require('../controllers/tenantUserController');
const AuditController = require('../controllers/auditController');
const TenantCertificateController = require('../controllers/tenantCertificateController');
const multer = require('multer');
const { authMiddleware, roleMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');
const { validateBody, validateQuery } = require('../middleware/validateMiddleware');
const {
  createTenantSchema,
  updateTenantSchema,
  patchStatusSchema,
  listTenantsQuerySchema,
  mifosConfigSchema,
  createTenantUserSchema,
  updateTenantUserSchema,
  updateUserPermissionsSchema,
  listTenantUsersQuerySchema
} = require('../validations/tenantSchemas');

const platformRoles = roleMiddleware(['super_admin', 'admin']);

// permissionMiddleware('users:manage') alone only checks that the caller's JWT-embedded,
// tenant-scoped membership contains that permission string - it does NOT verify :tenantId in
// the URL actually matches the caller's own tenant (confirmed by reading permissionMiddleware
// directly: no such comparison exists there or anywhere else on the sibling
// PUT/DELETE /:tenantId/users/:userId routes above). That's a pre-existing gap on those
// routes, out of scope to fix here, but this new reset-password action - which lets an admin
// take over another user's credentials - gets its own explicit guard rather than inheriting
// that gap silently.
function requireOwnTenantOrPlatformAdmin(req, res, next) {
  if (req.authContext?.isSuperAdmin) {
    return next();
  }
  if (req.tenant?.tenantId && req.tenant.tenantId === req.params.tenantId) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. You can only manage users within your own tenant.'
  });
}

const certUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

/**
 * @swagger
 * /api/v1/tenants:
 *   get:
 *     summary: List tenants
 *     description: Platform admins see all tenants; tenant users see only their own. Supports pagination and filters.
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, submitted, under_review, approved, active, rejected, suspended, disabled]
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by tenant name, FSP code, or tenantId
 *     responses:
 *       200:
 *         description: Paginated tenant list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         tenants:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/TenantPublic'
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create tenant
 *     description: Platform admin creates a new FSP tenant (starts in draft status).
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTenantRequest'
 *     responses:
 *       201:
 *         description: Tenant created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         tenant:
 *                           $ref: '#/components/schemas/TenantPublic'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: Duplicate fspCode or tenantId
 */
router.get('/', authMiddleware, validateQuery(listTenantsQuerySchema), TenantController.list);
router.post('/', authMiddleware, platformRoles, validateBody(createTenantSchema), TenantController.create);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}:
 *   get:
 *     summary: Get tenant by ID
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         example: acme-fsp
 *     responses:
 *       200:
 *         description: Tenant details
 *       404:
 *         description: Tenant not found
 *   put:
 *     summary: Update tenant
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTenantRequest'
 *     responses:
 *       200:
 *         description: Tenant updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Tenant not found
 */
router.get('/:tenantId', authMiddleware, permissionMiddleware('tenant:read'), TenantController.getById);
router.put('/:tenantId', authMiddleware, permissionMiddleware('tenant:update'), validateBody(updateTenantSchema), TenantController.update);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/status:
 *   patch:
 *     summary: Update tenant status
 *     description: Drive lifecycle transitions (activate, suspend, disable, etc.). Activation requires valid MIFOS config.
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatchTenantStatusRequest'
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status transition
 */
router.patch('/:tenantId/status', authMiddleware, platformRoles, validateBody(patchStatusSchema), TenantController.patchStatus);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/mifos-config:
 *   put:
 *     summary: Save MIFOS configuration
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MifosConfigRequest'
 *     responses:
 *       200:
 *         description: MIFOS config saved
 */
router.put('/:tenantId/mifos-config', authMiddleware, permissionMiddleware('tenant:update'), validateBody(mifosConfigSchema), TenantController.saveMifosConfig);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/mifos-config/validate:
 *   post:
 *     summary: Validate MIFOS connectivity
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Validation result with valid flag and checkedAt
 */
router.post('/:tenantId/mifos-config/validate', authMiddleware, permissionMiddleware('tenant:read'), validateBody(mifosConfigSchema), TenantController.validateMifosConfig);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/integration/health:
 *   get:
 *     summary: Integration health check
 *     description: MIFOS reachability and active API key count.
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Health summary
 */
router.get('/:tenantId/integration/health', authMiddleware, permissionMiddleware('tenant:read'), TenantController.integrationHealth);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/audit:
 *   get:
 *     summary: Tenant audit logs
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated audit logs
 */
router.get('/:tenantId/audit', authMiddleware, permissionMiddleware('audit:read'), AuditController.getTenantAuditLogs);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/users:
 *   get:
 *     summary: List tenant users
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated tenant user list
 *   post:
 *     summary: Create tenant user
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTenantUserRequest'
 *     responses:
 *       201:
 *         description: User invited/linked to tenant
 */
router.get('/:tenantId/users', authMiddleware, permissionMiddleware('users:manage'), validateQuery(listTenantUsersQuerySchema), TenantUserController.list);
router.post('/:tenantId/users', authMiddleware, permissionMiddleware('users:manage'), validateBody(createTenantUserSchema), TenantUserController.create);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/users/{userId}:
 *   put:
 *     summary: Update tenant user
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTenantUserRequest'
 *     responses:
 *       200:
 *         description: Membership updated
 *   delete:
 *     summary: Deactivate tenant user
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Membership deactivated
 */
router.put('/:tenantId/users/:userId', authMiddleware, permissionMiddleware('users:manage'), validateBody(updateTenantUserSchema), TenantUserController.update);
router.delete('/:tenantId/users/:userId', authMiddleware, permissionMiddleware('users:manage'), TenantUserController.remove);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/users/{userId}/permissions:
 *   put:
 *     summary: Edit a tenant user's custom permission overrides
 *     description: >
 *       Permissions-only counterpart to PUT /:tenantId/users/:userId. Requires users:manage
 *       AND that the caller belongs to :tenantId (or holds platform-admin/super-admin
 *       access). Rejects any reporting:* permission (API-key-only, never assignable to a
 *       human user) and blocks a caller from removing their own users:manage access.
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Permissions updated
 *       400:
 *         description: Invalid permission string, or would remove the caller's own admin access
 *       403:
 *         description: Caller does not belong to :tenantId
 */
router.put(
  '/:tenantId/users/:userId/permissions',
  authMiddleware,
  permissionMiddleware('users:manage'),
  requireOwnTenantOrPlatformAdmin,
  validateBody(updateUserPermissionsSchema),
  TenantUserController.updatePermissions
);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/users/{userId}/reset-password:
 *   post:
 *     summary: Admin-initiated password reset for a tenant user
 *     description: >
 *       Generates a new temporary password, invalidates the user's existing sessions, and
 *       returns one-time credentials for the admin to share. Requires users:manage AND that
 *       the caller belongs to :tenantId (or holds platform-admin/super-admin access).
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Password reset; one-time credentials returned
 */
router.post(
  '/:tenantId/users/:userId/reset-password',
  authMiddleware,
  permissionMiddleware('users:manage'),
  requireOwnTenantOrPlatformAdmin,
  TenantUserController.resetPassword
);

router.get('/:tenantId/certificates', authMiddleware, permissionMiddleware('tenant:read'), TenantCertificateController.getCertificates);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/certificates:
 *   post:
 *     summary: Upload ESS signing certificates (PEM)
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Certificates uploaded
 *   delete:
 *     summary: Remove tenant certificates
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Certificates removed
 */
router.post(
  '/:tenantId/certificates',
  authMiddleware,
  permissionMiddleware('tenant:update'),
  certUpload.fields([
    { name: 'publicCert', maxCount: 1 },
    { name: 'privateKey', maxCount: 1 },
    { name: 'caCert', maxCount: 1 }
  ]),
  TenantCertificateController.uploadCertificates
);
router.delete('/:tenantId/certificates', authMiddleware, permissionMiddleware('tenant:update'), TenantCertificateController.deleteCertificates);

module.exports = router;
