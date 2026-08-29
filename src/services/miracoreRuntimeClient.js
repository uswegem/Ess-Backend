const axios = require('axios');
const { isAllowedRuntimeHost, buildRuntimeRequestHeaders } = require('../utils/runtimeHostSecurity');

const DEFAULT_RUNTIME_BASE = process.env.MIRACORE_RUNTIME_BASE_URL || 'http://102.204.1.22';
const DEFAULT_RUNTIME_PORT = Number(process.env.MIRACORE_RUNTIME_PORT || 3002);

function getRuntimeBaseUrl(tenant) {
  const port = tenant?.runtimePort || DEFAULT_RUNTIME_PORT;
  const host = tenant?.runtimeHost || DEFAULT_RUNTIME_BASE;
  const normalizedHost = String(host).replace(/^https?:\/\//, '');
  if (!isAllowedRuntimeHost(normalizedHost)) {
    throw new Error(`Runtime host '${normalizedHost}' is not allowed by portal policy.`);
  }
  const base = String(host).includes('://') ? host : `http://${host}`;
  return `${base.replace(/\/$/, '')}:${port}`;
}

async function provisionRuntimeTenant(tenant, payload = {}) {
  const baseUrl = getRuntimeBaseUrl(tenant);
  try {
    const response = await axios.post(`${baseUrl}/api/v1/runtime/tenants/provision`, payload, {
      timeout: 15000,
      headers: buildRuntimeRequestHeaders({ source: 'portal-host' })
    });
    return { success: true, data: response.data || {}, status: response.status };
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Remote provision failed';
    return { success: false, error: message, status: error.response?.status || 500 };
  }
}

async function bootstrapRuntimeTenant(tenant, payload = {}) {
  const baseUrl = getRuntimeBaseUrl(tenant);
  try {
    const response = await axios.post(`${baseUrl}/api/v1/runtime/tenants/bootstrap`, payload, {
      timeout: 20000,
      headers: buildRuntimeRequestHeaders({ source: 'portal-host' })
    });
    return {
      success: true,
      data: response.data || {},
      status: response.status,
      databaseCreated: Boolean(response.data?.data?.databaseCreated || response.data?.databaseCreated),
      schemaApplied: Boolean(response.data?.data?.schemaApplied || response.data?.schemaApplied),
      adminUserCreated: Boolean(response.data?.data?.adminUserCreated || response.data?.adminUserCreated),
      adminUsername: response.data?.data?.adminUsername || response.data?.adminUsername || payload.adminUsername,
      steps: response.data?.data?.steps || response.data?.steps || {},
    };
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Remote bootstrap failed';
    return { success: false, error: message, status: error.response?.status || 500 };
  }
}

async function activateRuntimeTenant(tenant, payload = {}) {
  const baseUrl = getRuntimeBaseUrl(tenant);
  try {
    const response = await axios.post(`${baseUrl}/api/v1/runtime/tenants/activate`, payload, {
      timeout: 15000,
      headers: buildRuntimeRequestHeaders({ source: 'portal-host' })
    });
    return { success: true, data: response.data || {}, status: response.status };
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Remote activation failed';
    return { success: false, error: message, status: error.response?.status || 500 };
  }
}

module.exports = {
  getRuntimeBaseUrl,
  provisionRuntimeTenant,
  bootstrapRuntimeTenant,
  activateRuntimeTenant,
};
