const { Client } = require('pg');

class RuntimeDbConfigError extends Error {}

const REQUIRED_ENV_VARS = ['RUNTIME_DB_HOST', 'RUNTIME_DB_USER', 'RUNTIME_DB_PASSWORD', 'RUNTIME_DB_NAME'];

// No dev-grade fallbacks here on purpose: a missing runtime-host DB credential
// must fail closed, never silently connect as postgres/postgres/localhost.
function buildRuntimeDbConfig(config = {}) {
  const host = config.host || process.env.RUNTIME_DB_HOST;
  const port = Number(config.port || process.env.RUNTIME_DB_PORT || 5432);
  const user = config.user || process.env.RUNTIME_DB_USER;
  const password = config.password || process.env.RUNTIME_DB_PASSWORD;
  const database = config.database || process.env.RUNTIME_DB_NAME;

  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const configKey = { RUNTIME_DB_HOST: host, RUNTIME_DB_USER: user, RUNTIME_DB_PASSWORD: password, RUNTIME_DB_NAME: database }[key];
    return !configKey;
  });

  if (missing.length > 0) {
    throw new RuntimeDbConfigError(
      `Runtime host database is not configured: missing ${missing.join(', ')}. Refusing to fall back to default credentials.`
    );
  }

  return { host, port, user, password, database };
}

async function getRuntimeSqlClient(config = {}) {
  const dbConfig = buildRuntimeDbConfig(config);
  const client = new Client(dbConfig);
  await client.connect();
  return client;
}

module.exports = {
  RuntimeDbConfigError,
  buildRuntimeDbConfig,
  getRuntimeSqlClient,
};
