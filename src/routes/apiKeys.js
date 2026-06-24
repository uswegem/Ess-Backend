const express = require('express');
const router = express.Router({ mergeParams: true });
const ApiKeyController = require('../controllers/apiKeyController');
const { authMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateMiddleware');
const { createApiKeySchema } = require('../validations/tenantSchemas');

router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/api-keys:
 *   get:
 *     summary: List API keys for a tenant
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Masked API key list (no secrets)
 *   post:
 *     summary: Create API key
 *     description: Raw key and secret returned once in 201 response only.
 *     tags: [API Keys]
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
 *             $ref: '#/components/schemas/CreateApiKeyRequest'
 *     responses:
 *       201:
 *         description: API key created
 *       400:
 *         description: Validation error
 */
router.get('/', permissionMiddleware('api_keys:manage'), ApiKeyController.listKeys);
router.post('/', permissionMiddleware('api_keys:manage'), validateBody(createApiKeySchema), ApiKeyController.createKey);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/api-keys/{keyId}:
 *   delete:
 *     summary: Revoke API key
 *     description: M4 uses DELETE (M1 spec used POST /revoke).
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Key revoked
 */
router.delete('/:keyId', permissionMiddleware('api_keys:manage'), ApiKeyController.revokeKey);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/api-keys/{keyId}/usage:
 *   get:
 *     summary: Get API key usage metrics
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Usage stats
 */
router.get('/:keyId/usage', permissionMiddleware('api_keys:manage'), ApiKeyController.getKeyUsage);

/**
 * @swagger
 * /api/v1/tenants/{tenantId}/api-keys/{keyId}/rotate:
 *   post:
 *     summary: Rotate API key
 *     description: Revokes old key and returns new credentials once.
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: New key issued
 */
router.post('/:keyId/rotate', permissionMiddleware('api_keys:manage'), ApiKeyController.rotateKey);

module.exports = router;
