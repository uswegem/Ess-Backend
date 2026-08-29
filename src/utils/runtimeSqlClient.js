const { Client } = require('pg');

function buildRuntimeDbConfig(config = {}) {
  const host = config.host || process.env.RUNTIME_DB_HOST || 'localhost';
  const port = Number(config.port || process.env.RUNTIME_DB_PORT || 5432);
  const user = config.user || process.env.RUNTIME_DB_USER || 'postgres';
  const password = config.password || process.env.RUNTIME_DB_PASSWORD || 'postgres';
  const database = config.database || process.env.RUNTIME_DB_NAME || 'postgres';

  return { host, port, user, password, database };
}

async function getRuntimeSqlClient(config = {}) {
  const dbConfig = buildRuntimeDbConfig(config);
  const client = new Client(dbConfig);
  await client.connect();
  return client;
}

module.exports = {
  buildRuntimeDbConfig,
  getRuntimeSqlClient,
};
