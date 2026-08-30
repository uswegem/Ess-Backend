const { assertValidTenantCode, RuntimeSshConfigError } = require('../../src/utils/runtimeSshClient');

describe('runtimeSshClient tenant code validation', () => {
  it('accepts a well-formed tenant code', () => {
    expect(() => assertValidTenantCode('acme_bank')).not.toThrow();
  });

  it('rejects a tenant code with shell metacharacters', () => {
    expect(() => assertValidTenantCode('acme; rm -rf /')).toThrow(RuntimeSshConfigError);
  });

  it('rejects an empty tenant code', () => {
    expect(() => assertValidTenantCode('')).toThrow(RuntimeSshConfigError);
  });

  it('rejects a tenant code starting with a digit', () => {
    expect(() => assertValidTenantCode('1acme')).toThrow(RuntimeSshConfigError);
  });
});

describe('provisionTenantViaSsh config guard', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RUNTIME_SSH_HOST;
    delete process.env.RUNTIME_SSH_USER;
    delete process.env.RUNTIME_SSH_KEY_PATH;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('fails closed when SSH config is missing, rather than falling back to any default', async () => {
    const { provisionTenantViaSsh } = require('../../src/utils/runtimeSshClient');
    await expect(provisionTenantViaSsh('acme_bank')).rejects.toThrow(/not configured/);
  });
});
