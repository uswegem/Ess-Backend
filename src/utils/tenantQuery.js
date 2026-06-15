const logger = require('./logger');

function buildTenantQuery(tenantId, baseQuery = {}) {
  if (!tenantId) {
    throw new Error('tenantId is required for tenant-scoped queries');
  }
  return { ...baseQuery, tenantId };
}

function filterResults(results, tenantId) {
  if (!tenantId) return results;
  if (Array.isArray(results)) {
    return results.filter((item) => item && item.tenantId === tenantId);
  }
  if (results && results.tenantId && results.tenantId !== tenantId) {
    return null;
  }
  return results;
}

async function secureFindOne(Model, tenantId, filter = {}, options = {}) {
  return Model.findOne(buildTenantQuery(tenantId, filter), null, options);
}

async function secureFindMany(Model, tenantId, filter = {}, options = {}) {
  return Model.find(buildTenantQuery(tenantId, filter), null, options);
}

async function secureCreate(Model, tenantId, data, tenantObjectId = null) {
  const payload = {
    ...data,
    tenantId
  };
  if (tenantObjectId) {
    payload.tenant = tenantObjectId;
  }
  return Model.create(payload);
}

function getTenantIdFromRequest(req) {
  return req.tenant?.tenantId || null;
}

function requireTenantId(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) {
    const error = new Error('Tenant context is required');
    error.statusCode = 403;
    throw error;
  }
  return tenantId;
}

function withTenantFilter(req, baseQuery = {}) {
  const tenantId = requireTenantId(req);
  return buildTenantQuery(tenantId, baseQuery);
}

module.exports = {
  buildTenantQuery,
  filterResults,
  secureFindOne,
  secureFindMany,
  secureCreate,
  getTenantIdFromRequest,
  requireTenantId,
  withTenantFilter
};
