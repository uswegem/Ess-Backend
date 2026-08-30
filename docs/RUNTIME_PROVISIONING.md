# Runtime Host Tenant Provisioning

## What this is

Lets a platform admin trigger tenant creation on the **runtime host** — a
separate MiraCore/Fineract installation on its own physical machine
(`102.204.1.22`). This is unrelated to the live, MySQL/MariaDB-backed
zedone.miracore.app Fineract instance the rest of this app talks to via
`CBS_BASE_URL`/`MIFOS_*` — nothing here touches that instance, and the two
share no config, env vars, or code paths.

## How provisioning actually works

The runtime host already has its own hardened, idempotent script,
`provision_tenant.sh`, that creates a Postgres role (`tenant_<code>`) and
database (`fineract_tenant_<code>`) — with injection-guarded input
validation, safe idempotency (refuses to touch an existing role/database),
a strong random per-tenant password, and secrets written to a root-only
file on that host. Other infrastructure there (`pgbouncer`'s wildcard
routing) already depends on that script's naming convention.

**The portal does not connect to that host's Postgres directly, and does
not run its own schema/DDL.** An earlier version of this feature did —
it invented its own `users`/`audit_logs`/`tenants` schema under a different
naming convention, which would have duplicated and conflicted with
`provision_tenant.sh`'s ownership of tenant creation on that instance. That
approach was abandoned in favor of the portal simply triggering the
existing script.

The portal triggers it over a restricted SSH connection: `RUNTIME_SSH_USER`
is a runtime-host account whose key is forced (via `authorized_keys`
`command=` and/or sudoers) to only run
`sudo -u mfi provision_tenant.sh <tenant_code>` — nothing else. The tenant
code is validated locally (see `TENANT_CODE_PATTERN` in
`src/utils/runtimeSshClient.js`) before it's ever sent, as defense in depth
on top of the remote script's own validation.

## Lifecycle

- `POST /api/v1/runtime-provisioning/tenants` — create the portal-side
  MongoDB tracking record only.
- `POST .../tenants/:id/provision` — the real step: SSH-triggers
  `provision_tenant.sh`, creating the role + database on the runtime host.
  Idempotent — safe to retry after a failure.
- `POST .../tenants/:id/bootstrap` and `.../activate` — **not yet
  implemented.** `provision_tenant.sh` only creates the role and database;
  it deliberately does not run Liquibase migrations or register the tenant
  in Fineract's own `fineract_tenants` table. Both are required before a
  tenant is actually usable and neither has a design yet. These endpoints
  return `501 Not Implemented` rather than faking success — do not build
  fabricated logic here; that was the mistake in the original version of
  this feature.

All routes require `super_admin` or `admin` role and are rate-limited.

## Configuration

Set `RUNTIME_PROVISIONING_ENABLED=true` plus `RUNTIME_SSH_HOST`,
`RUNTIME_SSH_USER`, `RUNTIME_SSH_KEY_PATH` to point at the runtime host's
restricted SSH user. There are no dev-grade fallbacks — a missing required
var fails server startup.

`RUNTIME_PROVISIONING_ALLOWED_HOSTS` (default
`localhost,127.0.0.1,102.204.1.22`) still guards the informational
`runtimeHost` field on a `ProvisioningTenant` record, so it can never be
set to `zedone.miracore.app` — even though it no longer drives any actual
network call (the SSH target is fixed via `RUNTIME_SSH_HOST`, not a
per-tenant field).

## Network path

A dedicated IPsec (StrongSwan) tunnel connects this portal server
(`5.75.185.137`) to the runtime host (`102.204.1.22`), separate from and
additive to the pre-existing ESS_UTUMISHI tunnel — see
`/etc/ipsec.conf`'s `ikev2-vpn-runtime-provisioning` connection. SSH (and
only SSH) needs to be reachable over this path; there is no need for
Postgres (5432) to be reachable from the portal at all under this design.

## Recovery from a partial failure

`provision` is safe to re-call — `provision_tenant.sh`'s own idempotency
(refuses to touch an existing role/database) means a retried request after
a network blip or SSH timeout does not error or duplicate state. If a
`ProvisioningTenant` document shows `status: 'failed'` with
`provisioningJob.lastError` populated, check the SSH connectivity/host key
first, then simply re-call `provision`.

## Audit trail

`create`, `update`, and `provision` write `AuditLog` entries
(`runtime_tenant_create`, `_update`, `_provision`) with the acting user,
tenant id, and result. The SSH private key and any output from
`provision_tenant.sh` are never logged with secrets — the script itself
never prints the generated password, and the portal never asks for or
sees it.
