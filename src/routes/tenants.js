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
  listTenantUsersQuerySchema
} = require('../validations/tenantSchemas');

const platformRoles = roleMiddleware(['super_admin', 'admin']);

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
router.post('/:tenantId/mifos-config/validate', authMiddleware, permissionMiddleware('tenant:read'), TenantController.validateMifosConfig);

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

router.get('/:tenantId/certificates', authMiddleware, permissionMiddleware('tenant:read'), TenantCertificateController.getCertificates);
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
