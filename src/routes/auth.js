const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const apiController = require('../controllers/apiController');

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user and receive JWT token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             example:
 *               username: superadmin
 *               password: TestPassword123!
 *             properties:
 *               username:
 *                 type: string
 *                 example: superadmin
 *               password:
 *                 type: string
 *                 format: password
 *                 example: TestPassword123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string, description: JWT access token (~1h) }
 *                     refreshToken: { type: string, description: Refresh token for rotation }
 *                     user: { type: object }
 *                     activeTenant: { type: object, nullable: true }
 *                     memberships: { type: array, items: { type: object } }
 *                     permissions: { type: array, items: { type: string } }
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/v1/auth/login-with-api-key:
 *   post:
 *     summary: API key login
 *     description: System-to-system authentication using X-Tenant-Key header or body credentials. Returns JWT valid ~24h.
 *     tags: [Authentication]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Key
 *         schema: { type: string }
 *         description: mk_live_... or mk_test_... API key
 *       - in: header
 *         name: X-Tenant-Secret
 *         schema: { type: string }
 *         description: Optional API secret for validation
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApiKeyLoginRequest'
 *     responses:
 *       200:
 *         description: API key authentication successful
 *       400:
 *         description: Missing API key
 *       401:
 *         description: Invalid or inactive API key
 */
/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Exchange refresh token for new access + refresh pair (rotation). Public route.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid or expired refresh token
 */
// Public routes
router.post('/login', AuthController.login);
router.post('/login-with-api-key', AuthController.loginWithApiKey);
router.post('/refresh', AuthController.refresh);

/**
 * @swagger
 * /api/v1/auth/select-tenant:
 *   post:
 *     summary: Switch active tenant
 *     description: For users with multiple tenant memberships. Returns new JWT scoped to selected tenant.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SelectTenantRequest'
 *     responses:
 *       200:
 *         description: Tenant selected; new tokens issued
 *       400:
 *         description: tenantId required
 *       403:
 *         description: No membership for tenant
 */
/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: Get authenticated user profile
 *     description: Returns user, tenant memberships, active tenant, and auth context (M3 enhanced).
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile with tenant context
 *       401:
 *         description: Unauthorized
 */
// Protected routes
router.post('/select-tenant', authMiddleware, AuthController.selectTenant);
router.get('/profile', authMiddleware, AuthController.getProfile);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change password
 *     description: Change the authenticated user's password
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password
 *       401:
 *         description: Unauthorized
 */
router.post('/change-password', authMiddleware, AuthController.changePassword);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Logout user and invalidate session
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authMiddleware, AuthController.logout);

router.post('/product-create', authMiddleware, apiController.processRequest);

module.exports = router;
