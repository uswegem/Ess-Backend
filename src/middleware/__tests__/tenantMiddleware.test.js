const Tenant = require('../../models/Tenant');
const TenantUser = require('../../models/TenantUser');
const ApiKey = require('../../models/ApiKey');
const User = require('../../models/User');
const JWTUtils = require('../../utils/jwtUtils');
const {
  isPublicRoute,
  extractTenantFromToken,
  extractTenantFromApiKey,
  validateTenantSubscription,
  buildTenantContext,
  attachLegacyTenant
} = require('../tenantMiddleware');
const {
  validateApiKeyFormat,
  checkRateLimit,
  checkTenantIsActive,
  _rateLimitStore
} = require('../tenantValidator');

describe('tenantMiddleware', () => {
  let tenant;
  let user;
  let apiKeyRecord;
  let rawKey;
  let rawSecret;

  beforeEach(async () => {
    _rateLimitStore.clear();
    await ApiKey.deleteMany({});
    await TenantUser.deleteMany({});
    await Tenant.deleteMany({});
    await User.deleteMany({});

    tenant = await Tenant.create({
      tenantId: 'legacy-zedone',
      tenantName: 'Legacy',
      fspCode: 'FL8090',
      fspName: 'ZE DONE',
      contactPerson: 'Admin',
      contactEmail: 'admin@test.com',
      contactPhone: '+255700000000',
      status: 'active'
    });

    user = await User.create({
      username: `adminuser-${Date.now()}`,
      email: `admin-${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'super_admin',
      fullName: 'Admin User'
    });

    await TenantUser.create({
      tenantId: tenant.tenantId,
      tenant: tenant._id,
      userId: user._id,
      role: 'tenant_admin',
      isActive: true
    });

    const created = await ApiKey.createForTenant({ tenant, name: 'Test Key' });
    apiKeyRecord = created.apiKey;
    rawKey = created.rawKey;
    rawSecret = created.rawSecret;
  });

  describe('isPublicRoute', () => {
    it.each([
      ['/health', true],
      ['/api/v1/auth/login', true],
      ['/api/v1/auth/login-with-api-key', true],
      ['/api/v1/products', false],
      ['/api/frontend/loan/records', false]
    ])('path %s public=%s', (path, expected) => {
      expect(isPublicRoute({ path })).toBe(expected);
    });
  });

  describe('validateApiKeyFormat', () => {
    it('accepts mk_live keys', () => {
      expect(validateApiKeyFormat(rawKey)).toBe(true);
    });

    it('rejects invalid keys', () => {
      expect(validateApiKeyFormat('bad-key')).toBe(false);
      expect(validateApiKeyFormat('')).toBe(false);
      expect(validateApiKeyFormat(null)).toBe(false);
    });
  });

  describe('extractTenantFromApiKey', () => {
    it('resolves tenant from valid API key header', async () => {
      const req = {
        header: (name) => (name === 'X-Tenant-Key' ? rawKey : null),
        body: {},
        ip: '127.0.0.1'
      };
      const result = await extractTenantFromApiKey(req);
      expect(result.tenant.tenantId).toBe('legacy-zedone');
      expect(result.apiKey._id.toString()).toBe(apiKeyRecord._id.toString());
    });

    it('rejects invalid API key', async () => {
      const req = {
        header: (name) => (name === 'X-Tenant-Key' ? 'mk_live_invalid' : null),
        body: {},
        ip: '127.0.0.1'
      };
      await expect(extractTenantFromApiKey(req)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('validates API secret when provided', async () => {
      const req = {
        header: (name) => {
          if (name === 'X-Tenant-Key') return rawKey;
          if (name === 'X-Tenant-Secret') return rawSecret;
          return null;
        },
        body: {},
        ip: '127.0.0.1'
      };
      const result = await extractTenantFromApiKey(req);
      expect(result.tenant.fspCode).toBe('FL8090');
    });
  });

  describe('extractTenantFromToken', () => {
    it('resolves tenant from JWT with tenantId', async () => {
      const token = JWTUtils.generateToken(user, {
        tenantId: tenant.tenantId,
        tenantRole: 'tenant_admin',
        permissions: ['tenant:read']
      });
      const req = {
        header: (name) => (name === 'Authorization' ? `Bearer ${token}` : null)
      };
      const result = await extractTenantFromToken(req);
      expect(result.tenant.tenantId).toBe('legacy-zedone');
      expect(result.decoded.tenantId).toBe('legacy-zedone');
    });

    it('returns null when token has no tenantId', async () => {
      const token = JWTUtils.generateToken(user, {});
      const req = {
        header: (name) => (name === 'Authorization' ? `Bearer ${token}` : null)
      };
      const result = await extractTenantFromToken(req);
      expect(result).toBeNull();
    });
  });

  describe('validateTenantSubscription', () => {
    it('allows active tenant', async () => {
      await expect(validateTenantSubscription(buildTenantContext(tenant, 'jwt'))).resolves.toBeUndefined();
    });

    it('blocks suspended tenant', async () => {
      await expect(validateTenantSubscription({
        tenantId: 'x',
        status: 'suspended'
      })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('blocks draft tenant', async () => {
      await expect(validateTenantSubscription({
        tenantId: 'x',
        status: 'draft'
      })).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('attachLegacyTenant', () => {
    it('returns legacy tenant context', async () => {
      const ctx = await attachLegacyTenant();
      expect(ctx.tenantId).toBe('legacy-zedone');
      expect(ctx.authMethod).toBe('legacy');
    });
  });

  describe('checkTenantIsActive', () => {
    it('returns active tenant document', async () => {
      const doc = await checkTenantIsActive('legacy-zedone');
      expect(doc.tenantId).toBe('legacy-zedone');
    });

    it('throws for missing tenant', async () => {
      await expect(checkTenantIsActive('missing-tenant')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('checkRateLimit', () => {
    it('tracks per-tenant limits', () => {
      const limits = { requestsPerMinute: 2, requestsPerHour: 10 };
      checkRateLimit('legacy-zedone', limits);
      checkRateLimit('legacy-zedone', limits);
      expect(() => checkRateLimit('legacy-zedone', limits)).toThrow(expect.objectContaining({ statusCode: 429 }));
    });

    it('isolates limits per tenant', () => {
      const limits = { requestsPerMinute: 1, requestsPerHour: 5 };
      checkRateLimit('tenant-a', limits);
      expect(() => checkRateLimit('tenant-a', limits)).toThrow();
      expect(checkRateLimit('tenant-b', limits)).toBeDefined();
    });
  });
});
