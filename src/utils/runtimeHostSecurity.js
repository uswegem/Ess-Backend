function getAllowedRuntimeHosts() {
  const raw = process.env.MIRACORE_ALLOWED_HOSTS || 'localhost,127.0.0.1,102.204.1.22';
  return raw
    .split(',')
    .map((host) => String(host).trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedRuntimeHost(hostname = '') {
  const normalized = String(hostname || '').trim().toLowerCase();
  if (!normalized) return false;
  const allowed = getAllowedRuntimeHosts();
  return allowed.includes(normalized) || allowed.some((entry) => normalized === entry.replace(/^https?:\/\//, '').replace(/:\d+$/, ''));
}

function buildRuntimeRequestHeaders(config = {}) {
  const defaultApiKey = process.env.MIRACORE_RUNTIME_API_KEY || process.env.MIRACORE_PORTAL_API_KEY || 'dev-runtime-key';
  return {
    'Content-Type': 'application/json',
    'X-Miracore-Portal-Api-Key': config.apiKey || defaultApiKey,
    'X-Miracore-Source': config.source || 'portal-host',
    'X-Miracore-Request-Id': config.requestId || `portal-${Date.now()}`,
  };
}

module.exports = {
  getAllowedRuntimeHosts,
  isAllowedRuntimeHost,
  buildRuntimeRequestHeaders,
};
