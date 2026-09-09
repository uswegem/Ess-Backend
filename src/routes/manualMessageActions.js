// Authenticated MiraAdmin-facing routes for manually triggering outgoing
// messages / loan status requests. These reuse the same controllers as the
// unauthenticated external-facing routes in src/routes/api.js (mounted at
// /api, for ESS_UTUMISHI/Fineract callbacks) but are deliberately NOT the
// same router — api.js also carries the live external webhook entry points
// (/api/loan, /api/webhook/mifos) and must not be re-mounted or altered here.
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware, permissionMiddleware } = require('../middleware/authMiddleware');
const outgoingMessagesController = require('../controllers/outgoingMessagesController');
const loanStatusController = require('../controllers/loanStatusController');

const manualActionGuards = [
  authMiddleware,
  roleMiddleware(['super_admin', 'admin', 'tenant_admin', 'operations_manager']),
  permissionMiddleware('loans:operate')
];

router.post('/outgoing-message', ...manualActionGuards, outgoingMessagesController.triggerOutgoingMessage);
router.post('/loan-status-request', ...manualActionGuards, loanStatusController.triggerLoanStatusRequest);

module.exports = router;
