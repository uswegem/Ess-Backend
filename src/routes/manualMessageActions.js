// Authenticated MiraAdmin-facing routes for manually triggering outgoing
// messages / loan status requests. This is the only way to reach those
// controllers. The external-facing routes in src/routes/api.js (mounted at
// /api, for ESS_UTUMISHI/Fineract callbacks) are deliberately NOT part of this
// router — api.js carries the live external webhook entry points (/api/loan,
// /api/webhook/mifos) and must not be re-mounted here.
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');
const outgoingMessagesController = require('../controllers/outgoingMessagesController');
const loanStatusController = require('../controllers/loanStatusController');
const { messageTriggerPermission, requireTrigger } = require('../middleware/messageTriggerPermission');

const manualActionGuards = [
  authMiddleware,
  roleMiddleware(['super_admin', 'admin', 'tenant_admin', 'operations_manager']),
  permissionMiddleware('loans:operate')
];

router.post('/outgoing-message', ...manualActionGuards, messageTriggerPermission, outgoingMessagesController.triggerOutgoingMessage);
router.post('/loan-status-request', ...manualActionGuards, requireTrigger, loanStatusController.triggerLoanStatusRequest);

// LoanDetail.js frontend page (GET /api/v1/loan/:id, by _id or
// essApplicationNumber) -- distinct from POST /api/loan (the external
// ESS_UTUMISHI XML callback entry point in src/routes/api.js).
router.get('/loan/:id', ...manualActionGuards, async (req, res) => {
  try {
    const LoanMappingService = require('../services/loanMappingService');
    const loan = await LoanMappingService.getById(req.params.id, req.tenant?.tenantId);
    return res.json({ success: true, data: { loan } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

module.exports = router;
