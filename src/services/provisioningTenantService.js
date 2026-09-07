const ProvisioningTenant = require('../models/ProvisioningTenant');
const AuditLog = require('../models/AuditLog');
const { provisionTenantViaSsh, TENANT_CODE_PATTERN } = require('../utils/runtimeSshClient');
const { sendEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

class ProvisioningTenantServiceError extends Error {
  constructor(message, statusCode = 400, code = 'PROVISIONING_TENANT_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Runtime-host tenant creation is owned by provision_tenant.sh, an existing,
// already-hardened script on the runtime host that creates a Postgres role
// (tenant_<code>) and database (fineract_tenant_<code>) with its own
// idempotency, injection-guarding, and secret handling. The portal triggers
// it over a restricted SSH connection rather than duplicating that logic —
// see docs/RUNTIME_PROVISIONING.md for the full rationale.
//
// This intentionally does NOT run Liquibase migrations or register the
// tenant in Fineract's own fineract_tenants table — that is real, separate,
// currently-undesigned work. bootstrap/activate below say so explicitly
// rather than faking success.

async function logAudit({ action, description, actorUserId, tenantId, status, metadata }) {
  try {
    await AuditLog.create({
      action,
      description,
      userId: actorUserId,
      tenantId,
      status: status || 'success',
      metadata,
    });
  } catch (error) {
    // Audit logging must never block or crash the provisioning flow itself,
    // but a failure here should be visible in logs.
    // eslint-disable-next-line no-console
    console.error('Failed to write provisioning audit log', error.message);
  }
}

// Given a candidate tenant-code slug, returns the first available variant —
// the slug itself if free, otherwise slug2, slug3, ... Used both by the
// live uniqueness-check endpoint (as the admin types/blurs Tenant Name) and
// as a create-time safety net, so a race between the check and the actual
// submit can't silently produce a collision.
async function findAvailableTenantId(baseSlug) {
  const normalizedBase = String(baseSlug || '').toLowerCase();
  let candidate = normalizedBase;
  let suffix = 1;
  // Bounded loop — a real naming collision chain this long would indicate
  // something else is wrong, not a legitimate need to keep incrementing.
  while (suffix < 1000) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await ProvisioningTenant.exists({ tenantId: candidate });
    if (!exists) {
      return { tenantId: candidate, wasRenamed: candidate !== normalizedBase };
    }
    suffix += 1;
    candidate = `${normalizedBase}${suffix}`;
  }
  throw new ProvisioningTenantServiceError(
    `Could not find an available tenant id for '${normalizedBase}' after ${suffix} attempts`,
    409,
    'TENANT_ID_EXHAUSTED'
  );
}

async function checkTenantIdAvailability(baseSlug) {
  if (!TENANT_CODE_PATTERN.test(String(baseSlug || '').toLowerCase())) {
    throw new ProvisioningTenantServiceError(
      `'${baseSlug}' does not match the runtime host's tenant code format ${TENANT_CODE_PATTERN}`,
      400,
      'INVALID_TENANT_CODE'
    );
  }
  return findAvailableTenantId(baseSlug);
}

async function listProvisioningTenants({ page = 1, limit = 20, status, search } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { tenantId: new RegExp(search, 'i') },
      { tenantName: new RegExp(search, 'i') },
      { runtimeHost: new RegExp(search, 'i') },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [tenants, total] = await Promise.all([
    ProvisioningTenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    ProvisioningTenant.countDocuments(filter),
  ]);

  return {
    tenants: tenants.map((tenant) => tenant.toSafeJSON()),
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) || 1 },
  };
}

async function createProvisioningTenant(payload, { createdBy } = {}) {
  const requestedTenantId = (payload.tenantId || `tenant-${Date.now()}`).toLowerCase();
  if (!TENANT_CODE_PATTERN.test(requestedTenantId)) {
    throw new ProvisioningTenantServiceError(
      `tenantId '${requestedTenantId}' does not match the runtime host's tenant code format ${TENANT_CODE_PATTERN}`,
      400,
      'INVALID_TENANT_CODE'
    );
  }

  // Safety net: the frontend already checks availability as the admin types
  // (see checkTenantIdAvailability), but re-resolve here too so a race
  // between that check and this submit can't produce a silent collision —
  // append a number rather than erroring outright, same as the live check.
  const { tenantId, wasRenamed } = await findAvailableTenantId(requestedTenantId);

  const tenant = await ProvisioningTenant.create({
    ...payload,
    tenantId,
    createdBy,
    status: payload.status || 'draft',
    appConfig: payload.appConfig || {},
    notificationConfig: payload.notificationConfig || {},
  });

  await logAudit({
    action: 'runtime_tenant_create',
    description: `Runtime provisioning tenant created: ${tenant.tenantId}`,
    actorUserId: createdBy,
    tenantId: tenant.tenantId,
    metadata: wasRenamed ? { requestedTenantId, assignedTenantId: tenantId, reason: 'tenant_id_collision' } : undefined,
  });

  // "Request received" confirmation — fires now, since this is the part of
  // the flow that actually completes today. Deliberately does NOT mention
  // login credentials or a login URL: no admin user exists yet (that only
  // happens after a successful bootstrap, which isn't built — see the
  // NOT-YET-IMPLEMENTED note on bootstrapProvisioningTenant/
  // activateProvisioningTenant below for where the follow-up "tenant ready"
  // email belongs once that exists).
  if (tenant.contactEmail) {
    try {
      await sendEmail({
        to: tenant.contactEmail,
        subject: `MiraCore tenant request received: ${tenant.tenantName}`,
        text: `Hello ${tenant.contactFirstName},\n\n`
          + `We've received your MiraCore tenant provisioning request for "${tenant.tenantName}" `
          + `(tenant ID: ${tenant.tenantId}).\n\n`
          + `Our team will process this request. You'll receive a separate email once the tenant `
          + `is fully provisioned with your login details.\n\n`
          + `— MiraAdmin`,
      });
    } catch (error) {
      // Never let an email failure block tenant record creation — log and
      // move on, same principle as audit logging above.
      logger.warn('Failed to send tenant-request-received email', {
        tenantId: tenant.tenantId,
        contactEmail: tenant.contactEmail,
        error: error.message,
      });
    }
  }

  return tenant;
}

async function getProvisioningTenant(tenantId) {
  const tenant = await ProvisioningTenant.findOne({ tenantId });
  if (!tenant) {
    throw new ProvisioningTenantServiceError('Provisioning tenant not found', 404, 'PROVISIONING_TENANT_NOT_FOUND');
  }
  return tenant;
}

async function updateProvisioningTenant(tenantId, payload, { updatedBy } = {}) {
  const tenant = await getProvisioningTenant(tenantId);

  Object.keys(payload || {}).forEach((key) => {
    if (key === 'tenantId') return;
    if (payload[key] !== undefined) {
      tenant[key] = payload[key];
    }
  });

  if (updatedBy) tenant.updatedBy = updatedBy;
  await tenant.save();

  await logAudit({
    action: 'runtime_tenant_update',
    description: `Runtime provisioning tenant updated: ${tenant.tenantId}`,
    actorUserId: updatedBy,
    tenantId: tenant.tenantId,
  });

  return tenant;
}

// The only step that actually does something on the runtime host: SSH in
// and trigger provision_tenant.sh, which creates tenant_<code> (role) and
// fineract_tenant_<code> (database). Idempotent — the script itself refuses
// to touch an existing role/database, so re-running this after a partial
// failure (e.g. a network blip) is safe.
async function provisionProvisioningTenant(tenantId, { actorUserId } = {}) {
  const tenant = await getProvisioningTenant(tenantId);

  if (tenant.status === 'ready') {
    return tenant;
  }

  tenant.status = 'provisioning';
  tenant.provisioningJob = {
    jobId: `provision-${tenantId}-${Date.now()}`,
    status: 'queued',
    startedAt: new Date(),
  };
  await tenant.save();

  const result = await provisionTenantViaSsh(tenant.tenantId);

  if (result.success) {
    tenant.databaseName = `fineract_tenant_${tenant.tenantId}`;
    // Not a schema in the Postgres sense here — the runtime host doesn't
    // create one; kept only as the display name of the role provisioned.
    tenant.schemaName = `tenant_${tenant.tenantId}`;
  }

  tenant.provisioningJob = {
    ...(tenant.provisioningJob || {}),
    status: result.success ? 'completed' : 'failed',
    finishedAt: new Date(),
    lastError: result.success ? undefined : result.error,
  };
  tenant.status = result.success ? 'ready' : 'failed';
  await tenant.save();

  await logAudit({
    action: 'runtime_tenant_provision',
    description: `Runtime provisioning ${result.success ? 'succeeded' : 'failed'} for tenant: ${tenant.tenantId}`,
    actorUserId,
    tenantId: tenant.tenantId,
    status: result.success ? 'success' : 'failed',
    // stdout/stderr from provision_tenant.sh may include the role name but
    // never a password (the script writes that straight to a root-only
    // file on the runtime host and never prints it) — safe to log as-is,
    // but never log the SSH private key or connection details.
    metadata: result.success ? undefined : { error: result.error },
  });

  return tenant;
}

// NOT YET IMPLEMENTED. provision_tenant.sh only creates the Postgres role
// and database — it deliberately does not run Liquibase migrations or
// register the tenant in Fineract's own fineract_tenants table. Both are
// required before a tenant is actually usable, and neither has a design
// yet. Rather than fabricate schema/DDL here (the mistake in the original
// version of this feature), this fails clearly so it can't be mistaken for
// a completed step.
// TODO(tenant-ready-email): once bootstrap is real (Liquibase migrations +
// fineract_tenants registration + an actual admin user with a real,
// working login), send the "tenant ready" email here on success — subject
// along the lines of "Your MiraCore tenant is ready", body containing the
// initial admin password and the login URL (https://cbs.miracore.co.tz).
// Do NOT build this before bootstrap itself is real: there is no admin
// user and no working login to email yet, and faking one would be worse
// than not sending anything. See docs/RUNTIME_PROVISIONING.md.
async function bootstrapProvisioningTenant() {
  throw new ProvisioningTenantServiceError(
    'Runtime tenant bootstrap (Liquibase migrations + fineract_tenants registration) is not yet implemented — provision_tenant.sh only creates the role and database.',
    501,
    'BOOTSTRAP_NOT_IMPLEMENTED'
  );
}

// NOT YET IMPLEMENTED — see bootstrapProvisioningTenant above, including the
// TODO(tenant-ready-email) note. A tenant isn't meaningfully "active" in
// Fineract until bootstrap's remaining work is designed and built.
async function activateProvisioningTenant() {
  throw new ProvisioningTenantServiceError(
    'Runtime tenant activation is not yet implemented — depends on bootstrap (Liquibase migrations + fineract_tenants registration), which is not yet built.',
    501,
    'ACTIVATE_NOT_IMPLEMENTED'
  );
}

module.exports = {
  ProvisioningTenantServiceError,
  checkTenantIdAvailability,
  listProvisioningTenants,
  createProvisioningTenant,
  getProvisioningTenant,
  updateProvisioningTenant,
  provisionProvisioningTenant,
  bootstrapProvisioningTenant,
  activateProvisioningTenant,
};
