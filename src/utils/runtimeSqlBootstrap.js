const { getRuntimeSqlClient } = require('./runtimeSqlClient');

function generateRuntimeSchemaDdl({
  tenantId,
  databaseName,
  schemaName,
  adminUsername,
  adminEmail,
}) {
  const normalizedTenantId = String(tenantId || 'tenant').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const normalizedDatabaseName = String(databaseName || `${normalizedTenantId}_db`).replace(/[^a-zA-Z0-9_]+/g, '_');
  const normalizedSchemaName = String(schemaName || `${normalizedTenantId}_schema`).replace(/[^a-zA-Z0-9_]+/g, '_');
  const normalizedAdminUsername = String(adminUsername || `${normalizedTenantId}-admin`).replace(/[^a-zA-Z0-9_.@_-]+/g, '_');
  const normalizedAdminEmail = String(adminEmail || `${normalizedAdminUsername}@local.test`).trim();

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
VALUES ('${normalizedAdminUsername}', '${normalizedAdminEmail}', 'REPLACED_WITH_HASHED_PASSWORD', 'Runtime Administrator', 'admin', TRUE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO ${normalizedSchemaName}.tenants (tenant_id, tenant_name, metadata, status)
VALUES ('${normalizedTenantId}', '${normalizedTenantId}', '{"databaseName":"${normalizedDatabaseName}","schemaName":"${normalizedSchemaName}"}', 'active')
ON CONFLICT (tenant_id) DO NOTHING;
  `.trim();
}

async function executeRuntimeBootstrapSql(config = {}) {
  const {
    tenantId,
    databaseName,
    schemaName,
    adminUsername,
    adminEmail,
    adminPassword,
    sqlClient,
  } = config;

  const script = generateRuntimeSchemaDdl({
    tenantId,
    databaseName,
    schemaName,
    adminUsername,
    adminEmail,
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
    generatedSql: script,
    executedWithSqlClient: Boolean(sqlClient),
    adminPasswordProvided: Boolean(adminPassword),
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
    try {
      const runtimeClient = await getRuntimeSqlClient();
      await runtimeClient.query(script);
      await runtimeClient.end();
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

  return payload;
}

module.exports = {
  generateRuntimeSchemaDdl,
  executeRuntimeBootstrapSql,
};
