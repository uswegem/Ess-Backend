const { execFile } = require('child_process');

class RuntimeSshConfigError extends Error {}
class RuntimeSshExecError extends Error {
  constructor(message, { stdout, stderr, code } = {}) {
    super(message);
    this.stdout = stdout;
    this.stderr = stderr;
    this.code = code;
  }
}

// Same shape of validation the remote provision_tenant.sh itself applies
// (per the runtime-host operator) — checked here too as defense in depth,
// so an invalid tenant code never even leaves this process. Confirm this
// regex against the actual script before relying on it for production use.
const TENANT_CODE_PATTERN = /^[a-z][a-z0-9_]{2,30}$/;

function assertValidTenantCode(tenantCode) {
  if (!TENANT_CODE_PATTERN.test(String(tenantCode || ''))) {
    throw new RuntimeSshConfigError(
      `Invalid tenant code '${tenantCode}': must match ${TENANT_CODE_PATTERN}`
    );
  }
}

function requireSshConfig() {
  const host = process.env.RUNTIME_SSH_HOST;
  const user = process.env.RUNTIME_SSH_USER;
  const keyPath = process.env.RUNTIME_SSH_KEY_PATH;

  const missing = ['RUNTIME_SSH_HOST', 'RUNTIME_SSH_USER', 'RUNTIME_SSH_KEY_PATH'].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    throw new RuntimeSshConfigError(
      `Runtime SSH provisioning is not configured: missing ${missing.join(', ')}`
    );
  }

  return { host, user, keyPath };
}

// Invokes the runtime host's provision_tenant.sh over SSH. The remote side
// is expected to restrict this user's key to a forced command that reads
// the tenant code from $SSH_ORIGINAL_COMMAND, re-validates it, and runs
// `sudo -u mfi provision_tenant.sh <tenant_code>` — nothing else. This
// client sends the tenant code as the SSH command; it never has (and must
// never be given) a shell or any other capability on that host.
async function provisionTenantViaSsh(tenantCode) {
  assertValidTenantCode(tenantCode);
  const { host, user, keyPath } = requireSshConfig();

  const args = [
    '-i', keyPath,
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=10',
    `${user}@${host}`,
    tenantCode,
  ];

  return new Promise((resolve) => {
    execFile('ssh', args, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: new RuntimeSshExecError(
            `provision_tenant.sh invocation failed: ${error.message}`,
            { stdout, stderr, code: error.code }
          ).message,
          stdout,
          stderr,
        });
        return;
      }
      resolve({ success: true, stdout, stderr });
    });
  });
}

module.exports = {
  RuntimeSshConfigError,
  RuntimeSshExecError,
  TENANT_CODE_PATTERN,
  assertValidTenantCode,
  provisionTenantViaSsh,
};
