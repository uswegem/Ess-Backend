# Multi-Tenancy Middleware Documentation

## Overview

Milestone 3 adds tenant isolation to Ess-Backend. Every protected request resolves a tenant context before reaching controllers or services.

## Request Context

### `req.tenant`

```js
{
  tenantId: 'legacy-zedone',
  tenantObjectId: ObjectId('...'),
  fspCode: 'FL8090',
  fspName: 'ZE DONE',
  status: 'active',
  subscriptionPlan: 'standard',
  authMethod: 'jwt' // jwt | api_key | legacy
}
```

### `req.authContext`

```js
{
  principalType: 'user', // user | api_key
  userId: ObjectId('...'),
  apiKeyId: null,
  role: 'tenant_admin',
  permissions: ['tenant:read', 'users:manage'],
  isSuperAdmin: false
}
```

## Middleware Order

1. Security / body parsing
2. `attachTenantToRequest` (`tenantMiddleware.js`)
3. `tenantValidator` (`tenantValidator.js`)
4. `auditMiddleware`
5. Route handlers (`authMiddleware` on protected routes)

## Public Routes

These routes skip tenant enforcement:

- `GET /health`
- `GET /metrics`
- `GET /api-docs`, `GET /api-docs.json`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/login-with-api-key`

## Authentication

### JWT Login

`POST /api/v1/auth/login`

Returns backward-compatible `data.token` and `data.user`, plus:

- `data.activeTenant`
- `data.memberships`
- `data.permissions`

### API Key Login

`POST /api/v1/auth/login-with-api-key`

Headers:

- `X-Tenant-Key: mk_live_...`
- `X-Tenant-Secret: ...` (optional if secret validation enabled)

### Tenant Selection

`POST /api/v1/auth/select-tenant`

Body: `{ "tenantId": "legacy-zedone" }`

Returns a new JWT scoped to the selected tenant.

## Tenant-Scoped Queries

Use `tenantQuery` helpers — never query tenant-owned collections without `tenantId`:

```js
const { secureFindOne, secureCreate, buildTenantQuery } = require('../utils/tenantQuery');

const loan = await secureFindOne(LoanMapping, req.tenant.tenantId, {
  essApplicationNumber: 'APP-001'
});
```

## Rate Limiting

Per-tenant in-memory rate limits (default 60/min, 1000/hour). Returns `429` when exceeded.

Response headers:

- `X-RateLimit-Minute-Remaining`
- `X-RateLimit-Hour-Remaining`

## FSP Code Validation

`signatureMiddleware` rejects XML requests when payload `<FSPCode>` does not match `req.tenant.fspCode`.

## Feature Flag

| Variable | Default (dev) | Purpose |
|----------|---------------|---------|
| `TENANT_ENFORCEMENT` | `false` | When `false`, auto-attaches legacy tenant if none resolved |
| `LEGACY_TENANT_ID` | `legacy-zedone` | Default tenant for migrated data |
| `TENANT_SECRET_ENCRYPTION_KEY` | — | AES-256-GCM key for secrets (64-char hex) |

## Files

| File | Purpose |
|------|---------|
| `src/middleware/tenantMiddleware.js` | Resolves `req.tenant` |
| `src/middleware/tenantValidator.js` | Active check, rate limits, audit |
| `src/utils/tenantQuery.js` | Secure query helpers |
| `src/utils/tenantSecretCrypto.js` | Encryption and API key hashing |
| `scripts/migrate-to-multitenancy.js` | Backfill `tenantId` on existing data |

## Ess-Frontend (M3)

No UI changes. Existing login continues to work; extended response fields are ignored until Milestone 5.
