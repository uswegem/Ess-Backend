const express = require('express');
const rateLimit = require('express-rate-limit');
const OnboardingController = require('../controllers/onboardingController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateMiddleware');
const {
  createOnboardingDraftSchema,
  updateOnboardingDraftSchema,
  validateFspCodeSchema,
  reviewDecisionSchema
} = require('../validations/tenantSchemas');

const router = express.Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

/**
 * @swagger
 * /api/v1/onboarding/drafts:
 *   post:
 *     summary: Create onboarding draft
 *     description: Public endpoint to start FSP self-registration. Rate-limited.
 *     tags: [Onboarding]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOnboardingDraftRequest'
 *     responses:
 *       201:
 *         description: Draft tenant created
 *       400:
 *         description: Validation error
 *       409:
 *         description: FSP code already taken
 */
router.post('/drafts', publicLimiter, validateBody(createOnboardingDraftSchema), OnboardingController.createDraft);

/**
 * @swagger
 * /api/v1/onboarding/drafts/{tenantId}:
 *   get:
 *     summary: Get onboarding draft
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Draft details
 *   put:
 *     summary: Update onboarding draft
 *     tags: [Onboarding]
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
 *             $ref: '#/components/schemas/UpdateOnboardingDraftRequest'
 *     responses:
 *       200:
 *         description: Draft saved
 */
router.get('/drafts/:tenantId', authMiddleware, OnboardingController.getDraft);
router.put('/drafts/:tenantId', authMiddleware, validateBody(updateOnboardingDraftSchema), OnboardingController.updateDraft);

/**
 * @swagger
 * /api/v1/onboarding/validate-fsp-code:
 *   post:
 *     summary: Check FSP code availability
 *     tags: [Onboarding]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidateFspCodeRequest'
 *     responses:
 *       200:
 *         description: Availability result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     available: { type: boolean, example: true }
 */
router.post('/validate-fsp-code', publicLimiter, validateBody(validateFspCodeSchema), OnboardingController.validateFspCode);

/**
 * @swagger
 * /api/v1/onboarding/{tenantId}/submit:
 *   post:
 *     summary: Submit onboarding for review
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Submitted for platform review
 *       400:
 *         description: Incomplete application or invalid state
 */
router.post('/:tenantId/submit', authMiddleware, OnboardingController.submit);

/**
 * @swagger
 * /api/v1/onboarding/{tenantId}/review:
 *   post:
 *     summary: Approve or reject onboarding
 *     tags: [Onboarding]
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
 *             $ref: '#/components/schemas/ReviewDecisionRequest'
 *     responses:
 *       200:
 *         description: Review recorded
 *       403:
 *         description: Platform admin only
 */
router.post('/:tenantId/review', authMiddleware, roleMiddleware(['super_admin', 'admin']), validateBody(reviewDecisionSchema), OnboardingController.review);

module.exports = router;
