const express = require('express');
const router = express.Router();
const MiracoreController = require('../controllers/miracoreController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const platformAdminGuard = [authMiddleware, roleMiddleware(['super_admin', 'admin'])];

router.get('/tenants', ...platformAdminGuard, MiracoreController.list);
router.post('/tenants', ...platformAdminGuard, MiracoreController.create);
router.get('/tenants/:tenantId', ...platformAdminGuard, MiracoreController.getById);
router.put('/tenants/:tenantId', ...platformAdminGuard, MiracoreController.update);
router.post('/tenants/:tenantId/provision', ...platformAdminGuard, MiracoreController.provision);
router.post('/tenants/:tenantId/bootstrap', ...platformAdminGuard, MiracoreController.bootstrap);
router.post('/tenants/:tenantId/activate', ...platformAdminGuard, MiracoreController.activate);

module.exports = router;
