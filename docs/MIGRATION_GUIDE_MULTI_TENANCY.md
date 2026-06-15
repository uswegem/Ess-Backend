# Multi-Tenancy Migration Guide

## Prerequisites

1. Deploy Milestone 2 models (`Tenant`, `TenantUser`, `ApiKey`)
2. Deploy updated existing models with optional `tenantId`
3. Set environment variables:

```env
TENANT_SECRET_ENCRYPTION_KEY=<64-char-hex>
LEGACY_TENANT_ID=legacy-zedone
FSP_CODE=FL8090
FSP_NAME=ZE DONE
MONGODB_URI=mongodb+srv://...
```

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Migration Steps

### 1. Dry Run

```bash
cd Ess-Backend
node scripts/migrate-to-multitenancy.js --dry-run
```

Review counts for each collection. No writes are made.

### 2. Backup

Take a full MongoDB backup of the `ess` database before executing.

### 3. Execute Migration

```bash
node scripts/migrate-to-multitenancy.js
```

This will:

1. Create legacy tenant `legacy-zedone` (FSP `FL8090`)
2. Link active users via `TenantUser`
3. Backfill `tenantId` on `LoanMapping`, `MessageLog`, `AuditLog`, `Product`, `Notification`

### 4. Validate

```bash
node scripts/migrate-to-multitenancy.js --validate-only
```

### 5. Enable Enforcement

After validation:

```env
TENANT_ENFORCEMENT=true
```

Restart the backend.

## Rollback

```bash
node scripts/migrate-to-multitenancy.js --rollback
```

Removes `tenantId` from backfilled documents and deletes the legacy tenant record.

**Always restore from backup if rollback is insufficient.**

## Idempotency

The migration is safe to re-run. Existing `tenantId` values are not overwritten.

## Post-Migration

- Verify login still works for existing users
- Confirm loan/product APIs return data for legacy tenant
- Run isolation tests: `npm test -- tests/integration/tenantIsolation.test.js`
