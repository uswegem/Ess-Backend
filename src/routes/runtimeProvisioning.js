const express = require('express');
const router = express.Router();
const RuntimeProvisioningController = require('../controllers/runtimeProvisioningController');

router.post('/tenants/provision', RuntimeProvisioningController.provision);
router.post('/tenants/bootstrap', RuntimeProvisioningController.bootstrap);
router.post('/tenants/activate', RuntimeProvisioningController.activate);

module.exports = router;
