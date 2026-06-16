const express = require('express');
const router = express.Router({ mergeParams: true });
const ApiKeyController = require('../controllers/apiKeyController');
const { authMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', permissionMiddleware('api_keys:manage'), ApiKeyController.listKeys);
router.post('/', permissionMiddleware('api_keys:manage'), ApiKeyController.createKey);
router.delete('/:keyId', permissionMiddleware('api_keys:manage'), ApiKeyController.revokeKey);
router.post('/:keyId/rotate', permissionMiddleware('api_keys:manage'), ApiKeyController.rotateKey);

module.exports = router;
