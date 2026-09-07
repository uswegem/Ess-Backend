const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ProvisioningController = require('../controllers/provisioningController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// Every route here triggers real, side-effecting calls against the runtime
// host (a separate physical machine) — restrict to platform admins and cap
// the rate, matching the pattern already used for onboarding's public routes.
const platformAdminGuard = [authMiddleware, roleMiddleware(['super_admin', 'admin'])];
const provisioningLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many provisioning requests, please try again later.' },
});

router.use(provisioningLimiter);

router.get('/tenants/check-tenant-id', ...platformAdminGuard, ProvisioningController.checkTenantId);
router.get('/tenants', ...platformAdminGuard, ProvisioningController.list);
router.post('/tenants', ...platformAdminGuard, ProvisioningController.create);
router.get('/tenants/:tenantId', ...platformAdminGuard, ProvisioningController.getById);
router.put('/tenants/:tenantId', ...platformAdminGuard, ProvisioningController.update);
router.post('/tenants/:tenantId/provision', ...platformAdminGuard, ProvisioningController.provision);
router.post('/tenants/:tenantId/bootstrap', ...platformAdminGuard, ProvisioningController.bootstrap);
router.post('/tenants/:tenantId/activate', ...platformAdminGuard, ProvisioningController.activate);

module.exports = router;
