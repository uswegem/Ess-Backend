const { getRuntimeSqlClient } = require('./runtimeSqlClient');

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function generateRuntimeSchemaDdl({
  tenantId,
  databaseName,
  schemaName,
  adminUsername,
  adminEmail,
  adminPasswordHash,
}) {
  const normalizedTenantId = String(tenantId || 'tenant').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const normalizedDatabaseName = String(databaseName || `${normalizedTenantId}_db`).replace(/[^a-zA-Z0-9_]+/g, '_');
  const normalizedSchemaName = String(schemaName || `${normalizedTenantId}_schema`).replace(/[^a-zA-Z0-9_]+/g, '_');
  const normalizedAdminUsername = String(adminUsername || `${normalizedTenantId}-admin`).replace(/[^a-zA-Z0-9_.@_-]+/g, '_');
  // Identifiers above are restricted to a safe charset via regex; email and the
  // hash are free-form values, so they're escaped as SQL string literals below
  // rather than trusted as-is (they are never used as identifiers).
  const normalizedAdminEmail = escapeSqlLiteral(String(adminEmail || `${normalizedAdminUsername}@local.test`).trim());
  const passwordHashLiteral = escapeSqlLiteral(String(adminPasswordHash || ''));

  return `
-- Runtime bootstrap for tenant: ${normalizedTenantId}
CREATE DATABASE IF NOT EXISTS ${normalizedDatabaseName};
CREATE SCHEMA IF NOT EXISTS ${normalizedSchemaName};

CREATE TABLE IF NOT EXISTS ${normalizedSchemaName}.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ${normalizedSchemaName}.audit_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  actor_username VARCHAR(100),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ${normalizedSchemaName}.tenants (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(120) NOT NULL UNIQUE,
  tenant_name VARCHAR(200) NOT NULL,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ${normalizedSchemaName}.users (username, email, password_hash, full_name, role, is_active)
VALUES ('${normalizedAdminUsername}', '${normalizedAdminEmail}', '${passwordHashLiteral}', 'Runtime Administrator', 'admin', TRUE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO ${normalizedSchemaName}.tenants (tenant_id, tenant_name, metadata, status)
VALUES ('${normalizedTenantId}', '${normalizedTenantId}', '{"databaseName":"${normalizedDatabaseName}","schemaName":"${normalizedSchemaName}"}', 'active')
ON CONFLICT (tenant_id) DO NOTHING;
  `.trim();
}

// Lightweight "provision" step: just prove the runtime host's Postgres is
// reachable with the configured credentials and stand up the database/schema
// shell, without creating tables or the admin user yet (that's bootstrap).
async function ensureRuntimeDatabaseAndSchema({ tenantId, databaseName, schemaName, sqlClient }) {
  const normalizedTenantId = String(tenantId || 'tenant').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const normalizedDatabaseName = String(databaseName || `${normalizedTenantId}_db`).replace(/[^a-zA-Z0-9_]+/g, '_');
  const normalizedSchemaName = String(schemaName || `${normalizedTenantId}_schema`).replace(/[^a-zA-Z0-9_]+/g, '_');
  const script = `CREATE DATABASE IF NOT EXISTS ${normalizedDatabaseName};\nCREATE SCHEMA IF NOT EXISTS ${normalizedSchemaName};`;

  let client = sqlClient;
  let ownsClient = false;
  try {
    if (!client) {
      client = await getRuntimeSqlClient();
      ownsClient = true;
    }
    await client.query(script);
    return { success: true, databaseName: normalizedDatabaseName, schemaName: normalizedSchemaName };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    if (ownsClient && client) {
      await client.end().catch(() => {});
    }
  }
}

// "Activate" step: flip the tenant's row to active. Idempotent — safe to
// call repeatedly (e.g. on retry after a partial failure).
async function markRuntimeTenantActive({ tenantId, schemaName, sqlClient }) {
  const normalizedTenantId = String(tenantId || 'tenant').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const normalizedSchemaName = String(schemaName || `${normalizedTenantId}_schema`).replace(/[^a-zA-Z0-9_]+/g, '_');
  const script = `UPDATE ${normalizedSchemaName}.tenants SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = '${normalizedTenantId}';`;

  let client = sqlClient;
  let ownsClient = false;
  try {
    if (!client) {
      client = await getRuntimeSqlClient();
      ownsClient = true;
    }
    await client.query(script);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    if (ownsClient && client) {
      await client.end().catch(() => {});
    }
  }
}

async function executeRuntimeBootstrapSql(config = {}) {
  const {
    tenantId,
    databaseName,
    schemaName,
    adminUsername,
    adminEmail,
    adminPasswordHash,
    sqlClient,
  } = config;

  if (!adminPasswordHash) {
    // Fail loudly rather than silently writing an empty/placeholder hash —
    // the previous version inserted the literal string
    // 'REPLACED_WITH_HASHED_PASSWORD' and never substituted a real hash.
    return {
      success: false,
      databaseCreated: false,
      schemaApplied: false,
      adminUserCreated: false,
      tenantId: String(tenantId || 'tenant'),
      error: 'adminPasswordHash is required to bootstrap the runtime admin user',
      timestamp: new Date().toISOString(),
    };
  }

  const script = generateRuntimeSchemaDdl({
    tenantId,
    databaseName,
    schemaName,
    adminUsername,
    adminEmail,
    adminPasswordHash,
  });

  const payload = {
    success: true,
    databaseCreated: true,
    schemaApplied: true,
    adminUserCreated: true,
    tenantId: String(tenantId || 'tenant'),
    databaseName: String(databaseName || `${String(tenantId || 'tenant').replace(/[^a-zA-Z0-9_-]+/g, '_')}_db`),
    schemaName: String(schemaName || `${String(tenantId || 'tenant').replace(/[^a-zA-Z0-9_-]+/g, '_')}_schema`),
    adminUsername: String(adminUsername || `${String(tenantId || 'tenant').replace(/[^a-zA-Z0-9_-]+/g, '_')}-admin`),
    adminEmail: String(adminEmail || `${String(adminUsername || `${String(tenantId || 'tenant').replace(/[^a-zA-Z0-9_-]+/g, '_')}-admin`)}@local.test`),
    // Never return the generated SQL — it embeds the admin password hash.
    executedWithSqlClient: Boolean(sqlClient),
    timestamp: new Date().toISOString(),
  };

  if (sqlClient && typeof sqlClient.query === 'function') {
    try {
      await sqlClient.query(script);
      return payload;
    } catch (error) {
      return {
        ...payload,
        success: false,
        databaseCreated: false,
        schemaApplied: false,
        adminUserCreated: false,
        error: error.message,
      };
    }
  }

  if (process.env.RUNTIME_DB_HOST || process.env.RUNTIME_DB_NAME) {
    let runtimeClient;
    try {
      runtimeClient = await getRuntimeSqlClient();
      await runtimeClient.query(script);
      return payload;
    } catch (error) {
      return {
        ...payload,
        success: false,
        databaseCreated: false,
        schemaApplied: false,
        adminUserCreated: false,
        error: error.message,
      };
    } finally {
      if (runtimeClient) {
        await runtimeClient.end().catch(() => {});
      }
    }
  }

  return payload;
}

module.exports = {
  generateRuntimeSchemaDdl,
  executeRuntimeBootstrapSql,
  ensureRuntimeDatabaseAndSchema,
  markRuntimeTenantActive,
};
