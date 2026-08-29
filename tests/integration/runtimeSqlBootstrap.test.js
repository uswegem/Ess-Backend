const {
  generateRuntimeSchemaDdl,
  executeRuntimeBootstrapSql,
} = require('../../src/utils/runtimeSqlBootstrap');

describe('Runtime SQL bootstrap helpers', () => {
  it('builds PostgreSQL DDL for a fresh tenant database and schema', () => {
    const ddl = generateRuntimeSchemaDdl({
      tenantId: 'mira-ddl',
      databaseName: 'mira_ddl_db',
      schemaName: 'mira_ddl_schema',
      adminUsername: 'mira-ddl-admin',
      adminEmail: 'admin@mira-ddl.local',
    });

    expect(ddl).toMatch(/CREATE DATABASE/i);
    expect(ddl).toMatch(/CREATE SCHEMA/i);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS.*users/i);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS.*audit_logs/i);
  });

  it('returns a successful dry-run bootstrap result when no SQL client is configured', async () => {
    const result = await executeRuntimeBootstrapSql({
      tenantId: 'mira-dry',
      databaseName: 'mira_dry_db',
      schemaName: 'mira_dry_schema',
      adminUsername: 'mira-dry-admin',
      adminEmail: 'admin@mira-dry.local',
      adminPassword: 'AdminPass123!',
    });

    expect(result.success).toBe(true);
    expect(result.databaseCreated).toBe(true);
    expect(result.schemaApplied).toBe(true);
    expect(result.adminUserCreated).toBe(true);
    expect(result.generatedSql).toBeTruthy();
  });
});
