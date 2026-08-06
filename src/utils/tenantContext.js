const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

function runWithTenantContext(context, fn) {
  return tenantStorage.run(context || {}, fn);
}

function getActiveTenantContext() {
  return tenantStorage.getStore() || null;
}

function extractTenantParams(req) {
  return {
    tenantId: req?.tenant?.tenantId || null,
    tenantObjectId: req?.tenant?.tenantObjectId || null
  };
}

function runWithRequestTenant(req, fn) {
  return runWithTenantContext(extractTenantParams(req), fn);
}

module.exports = {
  runWithTenantContext,
  getActiveTenantContext,
  extractTenantParams,
  runWithRequestTenant
};
