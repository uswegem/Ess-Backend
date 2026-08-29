const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');
const api = require('./cbs.api');
const { runWithTenantContext } = require('../utils/tenantContext');

// Client mobile/email for the Delinquency Buckets detail page - sourced from Fineract's own
// Client object (GET /v1/clients), confirmed live to carry mobileNo/emailAddress natively,
// rather than a Mongo join against LoanMapping.metadata.clientData. Batched: this deployment
// has 13 clients total, so one GET /v1/clients?limit=1000 call returns all of them - the loan
// list endpoint doesn't support a client association (tested: ?associations=all adds nothing),
// so this has to be a second call, but it's one call total, not one per loan/client, and
// cached the same 2-minute way as fineractLoanRows.js.

const CACHE_TTL_MS = 2 * 60 * 1000;
const CLIENT_PAGE_LIMIT = 1000;

const cache = new Map(); // tenantId ('__all__' for cross-tenant) -> { data, expiresAt }

async function fetchTenantClients(tenantId) {
  const clients = [];
  let offset = 0;

  for (;;) {
    const response = await runWithTenantContext({ tenantId }, () =>
      api.maker.get('/v1/clients', { params: { limit: CLIENT_PAGE_LIMIT, offset } })
    );
    const items = response.data?.pageItems || [];
    if (items.length === 0) break;

    items.forEach((c) => clients.push({ id: c.id, mobileNo: c.mobileNo || null, emailAddress: c.emailAddress || null }));

    offset += items.length;
    if (items.length < CLIENT_PAGE_LIMIT) break;
  }

  return clients;
}

async function fetchAllTenantsClients() {
  const tenants = await Tenant.find({}).select('tenantId').lean();
  const results = await Promise.all(
    tenants.map(async (t) => {
      try {
        return await fetchTenantClients(t.tenantId);
      } catch (err) {
        logger.warn('Fineract client fetch failed for tenant', { tenantId: t.tenantId, error: err.message });
        return [];
      }
    })
  );
  return results.flat();
}

/**
 * @param {string|null} tenantId - null/omitted means cross-tenant (every tenant's clients combined)
 * @returns {Promise<Map<number, {mobileNo: string|null, emailAddress: string|null}>>} keyed by clientId
 */
async function getTenantClientContactsById(tenantId = null) {
  const key = tenantId || '__all__';
  const cached = cache.get(key);
  let clients;
  if (cached && cached.expiresAt > Date.now()) {
    clients = cached.data;
  } else {
    clients = tenantId ? await fetchTenantClients(tenantId) : await fetchAllTenantsClients();
    cache.set(key, { data: clients, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return new Map(clients.map((c) => [c.id, { mobileNo: c.mobileNo, emailAddress: c.emailAddress }]));
}

module.exports = { getTenantClientContactsById };
