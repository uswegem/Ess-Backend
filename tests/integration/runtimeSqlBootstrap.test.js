const {
  generateRuntimeSchemaDdl,
  executeRuntimeBootstrapSql,
  ensureRuntimeDatabaseAndSchema,
  markRuntimeTenantActive,
} = require('../../src/utils/runtimeSqlBootstrap');

function fakeSqlClient(queries) {
  return {
    query: jest.fn(async (sql) => {
      queries.push(sql);
      return { rows: [] };
    }),
    end: jest.fn(async () => {}),
  };
}

describe('Runtime SQL bootstrap helpers', () => {
  it('builds PostgreSQL DDL for a fresh tenant database and schema, with the password hash embedded safely', () => {
    const ddl = generateRuntimeSchemaDdl({
      tenantId: 'demo-ddl',
      databaseName: 'demo_ddl_db',
      schemaName: 'demo_ddl_schema',
      adminUsername: 'demo-ddl-admin',
      adminEmail: "admin@demo-ddl.local'; DROP TABLE users; --",
      adminPasswordHash: '$2a$10$fakehash',
    });

    expect(ddl).toMatch(/CREATE DATABASE/i);
    expect(ddl).toMatch(/CREATE SCHEMA/i);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS.*users/i);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS.*audit_logs/i);
    expect(ddl).toContain('$2a$10$fakehash');
    // The embedded single quote must be doubled (SQL-escaped), so the
    // malicious content stays inert string data rather than breaking out
    // of the literal to become a second executable statement.
    expect(ddl).toContain("admin@demo-ddl.local''; DROP TABLE users; --");
    expect(ddl).not.toMatch(/local';/);
  });

  it('requires an adminPasswordHash and refuses to bootstrap without one', async () => {
    const result = await executeRuntimeBootstrapSql({
      tenantId: 'demo-dry',
      databaseName: 'demo_dry_db',
      schemaName: 'demo_dry_schema',
      adminUsername: 'demo-dry-admin',
      adminEmail: 'admin@demo-dry.local',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/adminPasswordHash is required/);
  });

  it('executes the bootstrap script against an injected SQL client', async () => {
    const queries = [];
    const result = await executeRuntimeBootstrapSql({
      tenantId: 'demo-injected',
      databaseName: 'demo_injected_db',
      schemaName: 'demo_injected_schema',
      adminUsername: 'demo-injected-admin',
      adminEmail: 'admin@demo-injected.local',
      adminPasswordHash: '$2a$10$fakehash',
      sqlClient: fakeSqlClient(queries),
    });

    expect(result.success).toBe(true);
    expect(result.databaseCreated).toBe(true);
    expect(result.schemaApplied).toBe(true);
    expect(result.adminUserCreated).toBe(true);
    expect(result.generatedSql).toBeUndefined();
    expect(queries).toHaveLength(1);
  });

  it('ensures the database/schema shell via provision step', async () => {
    const queries = [];
    const result = await ensureRuntimeDatabaseAndSchema({
      tenantId: 'demo-provision',
      databaseName: 'demo_provision_db',
      schemaName: 'demo_provision_schema',
      sqlClient: fakeSqlClient(queries),
    });

    expect(result.success).toBe(true);
    expect(queries[0]).toMatch(/CREATE DATABASE IF NOT EXISTS demo_provision_db/);
  });

  it('marks the runtime tenant active idempotently', async () => {
    const queries = [];
    const result = await markRuntimeTenantActive({
      tenantId: 'demo-activate',
      schemaName: 'demo_activate_schema',
      sqlClient: fakeSqlClient(queries),
    });

    expect(result.success).toBe(true);
    expect(queries[0]).toMatch(/UPDATE demo_activate_schema\.tenants SET status = 'active'/);
  });
});
