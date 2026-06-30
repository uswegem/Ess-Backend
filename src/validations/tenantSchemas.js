const Joi = require('joi');

const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,62}$/;
const FSP_CODE_PATTERN = /^[A-Z0-9]{2,20}$/;

const TENANT_STATUSES = [
  'draft', 'submitted', 'under_review', 'approved', 'active', 'rejected', 'suspended', 'disabled'
];

const TENANT_ROLES = ['tenant_admin', 'operations_manager', 'finance_officer', 'support_staff'];

const addressSchema = Joi.object({
  line1: Joi.string().trim().max(200).allow('', null),
  line2: Joi.string().trim().max(200).allow('', null),
  city: Joi.string().trim().max(100).allow('', null),
  region: Joi.string().trim().max(100).allow('', null),
  country: Joi.string().trim().max(3).default('TZ')
});

const createTenantSchema = Joi.object({
  tenantId: Joi.string().trim().lowercase().pattern(TENANT_ID_PATTERN).optional(),
  tenantName: Joi.string().trim().min(1).max(200).required(),
  fspCode: Joi.string().trim().uppercase().pattern(FSP_CODE_PATTERN).required(),
  fspName: Joi.string().trim().min(1).max(200).required(),
  contactPerson: Joi.string().trim().min(1).max(120).required(),
  contactEmail: Joi.string().trim().lowercase().email().required(),
  contactPhone: Joi.string().trim().min(1).max(30).required(),
  organizationRegistrationNumber: Joi.string().trim().max(100).allow('', null),
  address: addressSchema.optional(),
  subscription: Joi.object({
    plan: Joi.string().valid('trial', 'standard', 'enterprise').default('standard'),
    monthlyLimit: Joi.number().integer().min(0).default(10000)
  }).optional()
});

const updateTenantSchema = createTenantSchema.fork(
  ['tenantName', 'fspCode', 'fspName', 'contactPerson', 'contactEmail', 'contactPhone'],
  (schema) => schema.optional()
).fork(['tenantId'], () => Joi.forbidden());

const patchStatusSchema = Joi.object({
  status: Joi.string().valid(...TENANT_STATUSES).required(),
  reason: Joi.string().trim().max(500).when('status', {
    is: Joi.valid('suspended', 'rejected', 'disabled'),
    then: Joi.optional(),
    otherwise: Joi.optional()
  })
});

const createOnboardingDraftSchema = Joi.object({
  tenantName: Joi.string().trim().min(1).max(200).required(),
  fspCode: Joi.string().trim().uppercase().pattern(FSP_CODE_PATTERN).required(),
  contactEmail: Joi.string().trim().lowercase().email().required(),
  tenantId: Joi.string().trim().lowercase().pattern(TENANT_ID_PATTERN).optional()
});

const updateOnboardingDraftSchema = Joi.object({
  companyInfo: createTenantSchema.optional(),
  mifosConfig: Joi.object().unknown(true).optional(),
  completedSteps: Joi.array().items(Joi.string().trim()).optional()
}).min(1);

const validateFspCodeSchema = Joi.object({
  fspCode: Joi.string().trim().uppercase().pattern(FSP_CODE_PATTERN).required()
});

const reviewDecisionSchema = Joi.object({
  decision: Joi.string().valid('approve', 'reject').required(),
  reason: Joi.string().trim().max(500).when('decision', {
    is: 'reject',
    then: Joi.optional(),
    otherwise: Joi.optional()
  })
});

const mifosConfigSchema = Joi.object({
  mode: Joi.string().valid('inherit_default', 'override').default('inherit_default'),
  baseUrl: Joi.string().trim().uri().when('mode', {
    is: 'override',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  tenantId: Joi.string().trim().when('mode', {
    is: 'override',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  makerUsername: Joi.string().trim().when('mode', {
    is: 'override',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  makerPassword: Joi.string().when('mode', {
    is: 'override',
    then: Joi.optional(),
    otherwise: Joi.optional()
  }),
  checkerUsername: Joi.string().trim().when('mode', {
    is: 'override',
    then: Joi.optional(),
    otherwise: Joi.optional()
  }),
  checkerPassword: Joi.string().when('mode', {
    is: 'override',
    then: Joi.optional(),
    otherwise: Joi.optional()
  }),
  callbackUrl: Joi.string().trim().uri().allow('', null).optional(),
  timeoutMs: Joi.number().integer().min(1000).max(120000).optional()
});

const createApiKeySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  permissions: Joi.array().items(Joi.string().trim()).default([]),
  expiresAt: Joi.date().iso().allow(null).optional(),
  ipWhitelist: Joi.array().items(Joi.string().trim()).optional(),
  rateLimit: Joi.object({
    requestsPerMinute: Joi.number().integer().min(1).optional(),
    requestsPerHour: Joi.number().integer().min(1).optional()
  }).optional(),
  keyPrefix: Joi.string().valid('mk_live', 'mk_test').default('mk_live')
});

const createTenantUserSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  fullName: Joi.string().trim().min(1).max(120).required(),
  role: Joi.string().valid(...TENANT_ROLES).required(),
  username: Joi.string().trim().min(3).max(50).optional(),
  phone: Joi.string().trim().max(30).allow('', null).optional(),
  permissions: Joi.array().items(Joi.string().trim()).optional()
});

const updateTenantUserSchema = Joi.object({
  role: Joi.string().valid(...TENANT_ROLES).optional(),
  permissions: Joi.array().items(Joi.string().trim()).optional(),
  isActive: Joi.boolean().optional()
}).min(1);

const listTenantsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...TENANT_STATUSES).optional(),
  search: Joi.string().trim().max(100).optional()
});

const listTenantUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

module.exports = {
  TENANT_STATUSES,
  TENANT_ROLES,
  TENANT_ID_PATTERN,
  FSP_CODE_PATTERN,
  createTenantSchema,
  updateTenantSchema,
  patchStatusSchema,
  createOnboardingDraftSchema,
  updateOnboardingDraftSchema,
  validateFspCodeSchema,
  reviewDecisionSchema,
  mifosConfigSchema,
  createApiKeySchema,
  createTenantUserSchema,
  updateTenantUserSchema,
  listTenantsQuerySchema,
  listTenantUsersQuerySchema
};
