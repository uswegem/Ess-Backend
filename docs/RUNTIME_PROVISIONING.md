# Runtime Host Tenant Provisioning

## What this is

Lets a platform admin provision a new tenant against the **runtime host** —
a separate, PostgreSQL-backed MiraCore installation on its own physical
machine (`102.204.1.22` by default). This is unrelated to the live,
MySQL/MariaDB-backed zedone.miracore.app Fineract instance that the rest of
this app talks to via `CBS_BASE_URL`/`MIFOS_*` — nothing here touches that
instance, and the two share no config, env vars, or code paths.

## Lifecycle

`POST /api/v1/runtime-provisioning/tenants` (create, MongoDB record only) →
`.../provision` (verify Postgres reachable, create database/schema shell) →
`.../bootstrap` (create tables + admin user) → `.../activate` (mark active).

All routes require `super_admin` or `admin` role and are rate-limited.

## Configuration

Set `RUNTIME_PROVISIONING_ENABLED=true` plus `RUNTIME_DB_HOST`,
`RUNTIME_DB_PORT`, `RUNTIME_DB_NAME`, `RUNTIME_DB_USER`,
`RUNTIME_DB_PASSWORD` to point at the runtime host's Postgres. There are no
dev-grade fallback credentials — a missing required var fails server startup
rather than silently connecting with default credentials. See
`.env.example` for the full list.

`RUNTIME_PROVISIONING_ALLOWED_HOSTS` (default
`localhost,127.0.0.1,102.204.1.22`) is a hard allowlist checked both when a
`ProvisioningTenant` record is created/updated and again before any SQL call
— a `runtimeHost` outside this list (e.g. `zedone.miracore.app`) is rejected
at both points.

## Recovery from a partial failure

Every step is idempotent and safe to re-call:
- `provision`: re-running against a tenant already `ready` is a no-op.
- `bootstrap`: the DDL uses `ON CONFLICT ... DO NOTHING`, so re-running after
  a partial failure does not error on duplicate rows.
- `activate`: a plain idempotent `UPDATE ... SET status = 'active'`.

If a `ProvisioningTenant` document shows `status: 'failed'` with
`bootstrap.lastError` populated, the safe recovery path is: fix the
underlying issue (bad credentials, unreachable host, etc.), then re-call the
same step's endpoint — do not re-run `provision` before checking whether the
database/schema already exists, and do not manually edit Postgres state
without also correcting the corresponding `ProvisioningTenant` /
`bootstrap` fields, or the two systems will disagree about tenant state.

There is no automatic cross-system rollback (e.g. dropping a partially
created Postgres schema if `bootstrap` fails); this is a manual runbook, not
a distributed transaction.

## Audit trail

Every lifecycle transition writes an `AuditLog` entry (`runtime_tenant_create`,
`_provision`, `_bootstrap`, `_activate`) with the acting user, tenant id, and
result — consistent with how the rest of this app audits sensitive actions.
Plaintext admin passwords and the runtime host's connection credentials are
never logged.
