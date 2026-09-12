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
- `POST .../tenants/:id/bootstrap` — SSH-triggers `bootstrap_tenant.sh`
  (same restricted-SSH pattern as `provision_tenant.sh`, dispatched via
  the `bootstrap:<code>` prefix that `miraadmin-provision-wrapper.sh` on
  the runtime host understands). It inserts one row into
  `tenant_server_connections` and one into `tenants` in Fineract's own
  `fineract_tenants` control-plane database. Idempotent — refuses to
  touch an existing `tenants` row for that identifier.

  **The tenant DB password is encrypted, and `master_password_hash` set,
  at insert time** — via `fineract_tenant_crypto.js` next to the script on
  the runtime host, which replicates Fineract's own
  `EncryptionUtil`/`DatabasePasswordEncryptor` exactly (AES-256-CBC,
  PBKDF2WithHmacSHA1 key derivation, master password `"fineract"` —
  Fineract's own unoverridden default on this host, confirmed by reading
  `application.properties` and checking that neither
  `FINERACT_DEFAULT_TENANTDB_MASTER_PASSWORD` nor
  `FINERACT_DEFAULT_MASTER_PASSWORD` is set anywhere in
  `/opt/mfi/k3s/manifests/fineract.yaml`).

  **An earlier version of this script inserted a plaintext password with
  `master_password_hash` left `NULL`**, on the assumption that Fineract's
  `TenantPasswordEncryptionTask` (a Liquibase custom task) would encrypt
  it in place on the next startup. That assumption was wrong and caused a
  real production incident: that changeset only ever runs once, the first
  time it is applied to a given `fineract_tenants` database — which
  already happened, long before this feature or any tenant it registers
  existed — so it never fires again for a row inserted afterward.
  `TenantDataSourceFactory` then throws `IllegalArgumentException: salt
  cannot be null` while building that tenant's connection, and because
  `TenantDatabaseUpgradeService` treats any single tenant's
  datasource-creation failure as fatal to the whole Fineract startup, one
  bad row crash-looped Fineract for *every* tenant on the host, not just
  the new one. Do not revert to that approach.

  **This alone still does not make the tenant usable**: Fineract's
  `TenantDatabaseUpgradeService` only loads new tenant rows, runs the
  per-tenant schema migration, and seeds the default admin user once, at
  Fineract's own startup — so the runtime host's Fineract needs a
  deliberate restart afterward before the tenant is actually live. That
  restart is a manual, separate step (it affects every tenant on that
  host), not automated by this endpoint.

- `POST .../tenants/:id/activate` — requires `status: 'ready'` and
  `bootstrap.status: 'completed'` (i.e. a restart has already confirmed
  the tenant's schema migrated cleanly — see above). Flips `status` to
  `'active'` and sends the "tenant ready" email with the login URL and the
  seeded default credentials (`mifos`/`password` — Fineract's own
  well-known seed account, not fabricated by this portal; Fineract forces
  a password change on its first login).

  **Deliberately does not call Fineract's own `/authentication` endpoint
  to prove the login works before activating** — that legacy Basic Auth
  endpoint currently returns `500` for *every* tenant on this runtime
  host, including `reprocheck` (the long-established, definitely-working
  seed tenant), for reasons unrelated to any individual tenant's setup.
  This instance has `FINERACT_SECURITY_OIDC_FEDERATION_ENABLED=true`, and
  real login most likely goes through Keycloak rather than this endpoint —
  Keycloak wiring is its own, still-undesigned piece of work (see
  `provision_tenant.sh`'s own comments). Gating activation on that live
  call would mean no tenant could ever be activated on this host.

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
