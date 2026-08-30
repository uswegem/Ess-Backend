// Allowlist of hosts the portal is permitted to treat as "the runtime host"
// for tenant provisioning. Deliberately does not include zedone.miracore.app
// (the live, MySQL-backed Fineract instance) — provisioning must never be
// able to target that instance, by accident or misconfiguration.
function getAllowedRuntimeHosts() {
  const raw = process.env.RUNTIME_PROVISIONING_ALLOWED_HOSTS || 'localhost,127.0.0.1,102.204.1.22';
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

module.exports = {
  getAllowedRuntimeHosts,
  isAllowedRuntimeHost,
};
