const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List platform users
 *     description: Platform admin only. Tenant-scoped user list when not super_admin (M3/M4).
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User list
 *       403:
 *         description: Requires super_admin or admin role
 *   post:
 *     summary: Create platform user
 *     description: Optionally pass tenantId + tenantRole to create TenantUser membership (M4).
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password, fullName, role]
 *             properties:
 *               username: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               fullName: { type: string }
 *               role: { type: string, enum: [super_admin, admin, loan_officer] }
 *               phone: { type: string }
 *               tenantId: { type: string, description: Optional — creates TenantUser link }
 *               tenantRole: { type: string, enum: [tenant_admin, operations_manager, finance_officer, support_staff] }
 *     responses:
 *       201:
 *         description: User created
 *       403:
 *         description: Requires super_admin or admin role
 */
router.get('/', roleMiddleware(['super_admin', 'admin']), UserController.getUsers);
router.post('/', roleMiddleware(['super_admin', 'admin']), UserController.createUser);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string }
 *               role: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: User updated
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 */
router.get('/:id', roleMiddleware(['super_admin', 'admin']), UserController.getUserById);
router.put('/:id', roleMiddleware(['super_admin', 'admin']), UserController.updateUser);
router.delete('/:id', roleMiddleware(['super_admin', 'admin']), UserController.deleteUser);

module.exports = router;
