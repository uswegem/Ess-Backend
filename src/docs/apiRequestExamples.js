/**
 * Canonical M4 API request examples — single source of truth for Swagger, Postman, and docs.
 */

const API_EXAMPLES = {
  login: {
    username: 'superadmin',
    password: 'TestPassword123!'
  },
  createTenant: {
    tenantName: 'Acme Microfinance',
    fspCode: 'ACME01',
    fspName: 'Acme Microfinance Ltd',
    contactPerson: 'Jane Doe',
    contactEmail: 'jane@acme.co.tz',
    contactPhone: '+255712345678'
  },
  updateTenant: {
    tenantName: 'Acme Microfinance (Updated)',
    contactPerson: 'Jane Doe',
    contactEmail: 'jane@acme.co.tz',
    contactPhone: '+255712345679'
  },
  patchStatusApproved: {
    status: 'approved',
    reason: 'Documentation complete'
  },
  patchStatusActive: {
    status: 'active'
  },
  mifosConfigInherit: {
    mode: 'inherit_default'
  },
  mifosConfigOverride: {
    mode: 'override',
    baseUrl: 'https://fineract.example.com/fineract-provider/api',
    tenantId: 'acme-uat',
    makerUsername: 'maker',
    makerPassword: 'secret',
    checkerUsername: 'checker',
    checkerPassword: 'secret',
    timeoutMs: 30000
  },
  createOnboardingDraft: {
    tenantName: 'Acme Microfinance',
    fspCode: 'ACME01',
    contactEmail: 'draft@acme.co.tz'
  },
  updateOnboardingDraft: {
    companyInfo: {
      tenantName: 'Acme Microfinance',
      fspCode: 'ACME01',
      fspName: 'Acme Microfinance Ltd',
      contactPerson: 'Jane Doe',
      contactEmail: 'jane@acme.co.tz',
      contactPhone: '+255712345678'
    },
    mifosConfig: { mode: 'inherit_default' },
    completedSteps: ['company', 'mifos']
  },
  validateFspCode: {
    fspCode: 'ACME01'
  },
  reviewDecision: {
    decision: 'approve'
  },
  createTenantUser: {
    email: 'officer@acme.co.tz',
    fullName: 'Loan Officer',
    role: 'finance_officer'
  },
  updateTenantUser: {
    role: 'tenant_admin'
  },
  createApiKey: {
    name: 'Production'
  }
};

/**
 * M4 endpoint manifest for Postman generation.
 * bodyKey references API_EXAMPLES; null = no body.
 */
const M4_ENDPOINTS = [
  { folder: 'Auth', name: 'Login', method: 'POST', path: '/api/v1/auth/login', auth: false, bodyKey: 'login' },
  { folder: 'Tenants', name: 'Create Tenant', method: 'POST', path: '/api/v1/tenants', auth: true, bodyKey: 'createTenant', captureTenantId: true },
  { folder: 'Tenants', name: 'List Tenants', method: 'GET', path: '/api/v1/tenants', auth: true, query: [{ key: 'page', value: '1' }, { key: 'limit', value: '20' }] },
  { folder: 'Tenants', name: 'Get Tenant', method: 'GET', path: '/api/v1/tenants/{{tenantId}}', auth: true },
  { folder: 'Tenants', name: 'Update Tenant', method: 'PUT', path: '/api/v1/tenants/{{tenantId}}', auth: true, bodyKey: 'updateTenant' },
  { folder: 'Tenants', name: 'Patch Tenant Status (approve)', method: 'PATCH', path: '/api/v1/tenants/{{tenantId}}/status', auth: true, bodyKey: 'patchStatusApproved' },
  { folder: 'Tenants', name: 'Patch Tenant Status (active)', method: 'PATCH', path: '/api/v1/tenants/{{tenantId}}/status', auth: true, bodyKey: 'patchStatusActive' },
  { folder: 'Tenants', name: 'Save MIFOS Config', method: 'PUT', path: '/api/v1/tenants/{{tenantId}}/mifos-config', auth: true, bodyKey: 'mifosConfigInherit' },
  { folder: 'Tenants', name: 'Validate MIFOS Config', method: 'POST', path: '/api/v1/tenants/{{tenantId}}/mifos-config/validate', auth: true },
  { folder: 'Tenants', name: 'Integration Health', method: 'GET', path: '/api/v1/tenants/{{tenantId}}/integration/health', auth: true },
  { folder: 'Tenants', name: 'Tenant Audit Logs', method: 'GET', path: '/api/v1/tenants/{{tenantId}}/audit', auth: true, query: [{ key: 'page', value: '1' }, { key: 'limit', value: '50' }] },
  { folder: 'Onboarding', name: 'Create Draft', method: 'POST', path: '/api/v1/onboarding/drafts', auth: false, bodyKey: 'createOnboardingDraft', captureTenantId: true },
  { folder: 'Onboarding', name: 'Get Draft', method: 'GET', path: '/api/v1/onboarding/drafts/{{tenantId}}', auth: true },
  { folder: 'Onboarding', name: 'Update Draft', method: 'PUT', path: '/api/v1/onboarding/drafts/{{tenantId}}', auth: true, bodyKey: 'updateOnboardingDraft' },
  { folder: 'Onboarding', name: 'Validate FSP Code', method: 'POST', path: '/api/v1/onboarding/validate-fsp-code', auth: false, bodyKey: 'validateFspCode' },
  { folder: 'Onboarding', name: 'Submit Onboarding', method: 'POST', path: '/api/v1/onboarding/{{tenantId}}/submit', auth: true },
  { folder: 'Onboarding', name: 'Review Onboarding', method: 'POST', path: '/api/v1/onboarding/{{tenantId}}/review', auth: true, bodyKey: 'reviewDecision' },
  { folder: 'Tenant Users', name: 'List Tenant Users', method: 'GET', path: '/api/v1/tenants/{{tenantId}}/users', auth: true, query: [{ key: 'page', value: '1' }, { key: 'limit', value: '20' }] },
  { folder: 'Tenant Users', name: 'Create Tenant User', method: 'POST', path: '/api/v1/tenants/{{tenantId}}/users', auth: true, bodyKey: 'createTenantUser', captureUserId: true },
  { folder: 'Tenant Users', name: 'Update Tenant User', method: 'PUT', path: '/api/v1/tenants/{{tenantId}}/users/{{userId}}', auth: true, bodyKey: 'updateTenantUser' },
  { folder: 'Tenant Users', name: 'Deactivate Tenant User', method: 'DELETE', path: '/api/v1/tenants/{{tenantId}}/users/{{userId}}', auth: true },
  { folder: 'API Keys', name: 'List API Keys', method: 'GET', path: '/api/v1/tenants/{{tenantId}}/api-keys', auth: true },
  { folder: 'API Keys', name: 'Create API Key', method: 'POST', path: '/api/v1/tenants/{{tenantId}}/api-keys', auth: true, bodyKey: 'createApiKey', captureKeyId: true },
  { folder: 'API Keys', name: 'API Key Usage', method: 'GET', path: '/api/v1/tenants/{{tenantId}}/api-keys/{{keyId}}/usage', auth: true },
  { folder: 'API Keys', name: 'Rotate API Key', method: 'POST', path: '/api/v1/tenants/{{tenantId}}/api-keys/{{keyId}}/rotate', auth: true },
  { folder: 'API Keys', name: 'Revoke API Key', method: 'DELETE', path: '/api/v1/tenants/{{tenantId}}/api-keys/{{keyId}}', auth: true }
];

module.exports = {
  API_EXAMPLES,
  M4_ENDPOINTS
};
