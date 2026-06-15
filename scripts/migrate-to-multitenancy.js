#!/usr/bin/env node
/**
 * Multi-Tenancy Migration Script
 *
 * Migrates existing single-tenant MiraCore data into the multi-tenant schema
 * by creating a legacy tenant and backfilling tenantId on all tenant-owned collections.
 *
 * Usage:
 *   node scripts/migrate-to-multitenancy.js --dry-run
 *   node scripts/migrate-to-multitenancy.js
 *   node scripts/migrate-to-multitenancy.js --validate-only
 *   node scripts/migrate-to-multitenancy.js --rollback
 *   node scripts/migrate-to-multitenancy.js --continue-on-error
 *
 * Environment:
 *   MONGODB_URI                  MongoDB connection string
 *   LEGACY_TENANT_ID             Default: legacy-zedone
 *   FSP_CODE                     Default: FL8090
 *   FSP_NAME                     Default: ZE DONE
 *   TENANT_SECRET_ENCRYPTION_KEY Required when seeding MIFOS credentials
 */

require('dotenv').config();

const mongoose = require('mongoose');

const BATCH_SIZE = 500;
const LEGACY_TENANT_ID = process.env.LEGACY_TENANT_ID || 'legacy-zedone';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ROLLBACK = args.includes('--rollback');
const VALIDATE_ONLY = args.includes('--validate-only');
const CONTINUE_ON_ERROR = args.includes('--continue-on-error');

const Tenant = require('../src/models/Tenant');
const TenantUser = require('../src/models/TenantUser');
const User = require('../src/models/User');
const LoanMapping = require('../src/models/LoanMapping');
const MessageLog = require('../src/models/MessageLog');
const AuditLog = require('../src/models/AuditLog');
const Product = require('../src/models/Product');
const Notification = require('../src/models/Notification');

class MultiTenancyMigration {
  constructor() {
    this.logs = [];
    this.stats = {
      legacyTenantCreated: 0,
      tenantUsersCreated: 0,
      loanMappingsUpdated: 0,
      messageLogsUpdated: 0,
      auditLogsUpdated: 0,
      productsUpdated: 0,
      notificationsUpdated: 0,
      errors: []
    };
  }

  log(message, level = 'info') {
    const entry = { timestamp: new Date().toISOString(), level, message };
    this.logs.push(entry);
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  getLegacyTenantSeed() {
    return {
      tenantId: LEGACY_TENANT_ID,
      tenantName: process.env.LEGACY_TENANT_NAME || 'Legacy ZE DONE Tenant',
      fspCode: process.env.FSP_CODE || 'FL8090',
      fspName: process.env.FSP_NAME || 'ZE DONE',
      contactPerson: process.env.LEGACY_CONTACT_PERSON || 'System Migration',
      contactEmail: process.env.LEGACY_CONTACT_EMAIL || 'migration@miracore.local',
      contactPhone: process.env.LEGACY_CONTACT_PHONE || '+255000000000',
      status: 'active',
      mifosConfig: {
        mode: 'inherit_default',
        baseUrl: process.env.CBS_BASE_URL,
        tenantId: process.env.CBS_Tenant,
        makerUsername: process.env.CBS_MAKER_USERNAME,
        makerPasswordEncrypted: process.env.CBS_MAKER_PASSWORD,
        checkerUsername: process.env.CBS_CHECKER_USERNAME,
        checkerPasswordEncrypted: process.env.CBS_CHECKER_PASSWORD,
        isConfigured: Boolean(process.env.CBS_BASE_URL),
        timeoutMs: Number(process.env.CBS_TIMEOUT || 30000)
      },
      metadata: {
        notes: 'Auto-created by migrate-to-multitenancy.js for existing single-tenant data'
      }
    };
  }

  async connect() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore';
    this.log(`Connecting to MongoDB: ${uri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(uri);
    this.log('Connected to MongoDB');
  }

  async disconnect() {
    await mongoose.disconnect();
    this.log('Disconnected from MongoDB');
  }

  async countMissingTenantId(Model, filter = {}) {
    return Model.countDocuments({
      ...filter,
      $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: '' }]
    });
  }

  async ensureLegacyTenant() {
    let tenant = await Tenant.findOne({ tenantId: LEGACY_TENANT_ID });
    if (tenant) {
      this.log(`Legacy tenant already exists: ${LEGACY_TENANT_ID}`);
      return tenant;
    }

    const seed = this.getLegacyTenantSeed();
    this.log(`Creating legacy tenant: ${LEGACY_TENANT_ID}`);

    if (DRY_RUN) {
      this.stats.legacyTenantCreated = 1;
      return { _id: new mongoose.Types.ObjectId(), ...seed };
    }

    tenant = await Tenant.create(seed);
    this.stats.legacyTenantCreated = 1;
    this.log(`Legacy tenant created with _id=${tenant._id}`);
    return tenant;
  }

  async backfillCollection({ name, Model, tenant, extraFilter = {} }) {
    const filter = {
      ...extraFilter,
      $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: '' }]
    };

    const total = await Model.countDocuments(filter);
    this.log(`${name}: ${total} documents need tenantId backfill`);

    if (total === 0) return 0;

    let updated = 0;
    let lastId = null;

    while (true) {
      const batchFilter = { ...filter };
      if (lastId) {
        batchFilter._id = { $gt: lastId };
      }

      const batch = await Model.find(batchFilter)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .select('_id');

      if (batch.length === 0) break;

      const ids = batch.map((doc) => doc._id);
      lastId = ids[ids.length - 1];

      if (DRY_RUN) {
        updated += ids.length;
        continue;
      }

      const result = await Model.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            tenantId: tenant.tenantId,
            tenant: tenant._id
          }
        }
      );

      updated += result.modifiedCount;
    }

    this.log(`${name}: backfilled ${updated} documents`);
    return updated;
  }

  async createLegacyTenantUsers(tenant) {
    const users = await User.find({ isActive: { $ne: false } });
    this.log(`Creating TenantUser memberships for ${users.length} active users`);

    let created = 0;
    for (const user of users) {
      const exists = await TenantUser.findOne({
        tenantId: tenant.tenantId,
        userId: user._id
      });

      if (exists) continue;

      const role = user.role === 'super_admin' ? 'tenant_admin' : 'operations_manager';

      if (DRY_RUN) {
        created += 1;
        continue;
      }

      await TenantUser.create({
        tenantId: tenant.tenantId,
        tenant: tenant._id,
        userId: user._id,
        role,
        isActive: true,
        activatedAt: new Date()
      });
      created += 1;
    }

    this.stats.tenantUsersCreated = created;
    this.log(`TenantUser records created: ${created}`);
  }

  async validate() {
    this.log('Running post-migration validation...');

    const checks = [
      { name: 'LoanMapping', model: LoanMapping },
      { name: 'MessageLog', model: MessageLog },
      { name: 'Product', model: Product },
      { name: 'Notification', model: Notification },
      {
        name: 'AuditLog (non-system)',
        model: AuditLog,
        filter: { action: { $ne: 'system_event' } }
      }
    ];

    const failures = [];

    for (const check of checks) {
      const missing = await this.countMissingTenantId(check.model, check.filter || {});
      this.log(`${check.name} missing tenantId: ${missing}`);
      if (missing > 0) failures.push({ collection: check.name, missing });
    }

    const legacyTenant = await Tenant.findOne({ tenantId: LEGACY_TENANT_ID });
    if (!legacyTenant) {
      failures.push({ collection: 'Tenant', missing: 'legacy tenant not found' });
    }

    if (failures.length > 0) {
      throw new Error(`Validation failed: ${JSON.stringify(failures, null, 2)}`);
    }

    this.log('Validation passed — all tenant-owned records have tenantId');
  }

  async rollback() {
    this.log('Starting rollback — removing tenantId from backfilled collections');

    const tenant = await Tenant.findOne({ tenantId: LEGACY_TENANT_ID });
    if (!tenant) {
      this.log('No legacy tenant found — nothing to rollback');
      return;
    }

    const collections = [
      { name: 'LoanMapping', Model: LoanMapping },
      { name: 'MessageLog', Model: MessageLog },
      { name: 'AuditLog', Model: AuditLog },
      { name: 'Product', Model: Product },
      { name: 'Notification', Model: Notification }
    ];

    for (const { name, Model } of collections) {
      if (DRY_RUN) {
        const count = await Model.countDocuments({ tenantId: tenant.tenantId });
        this.log(`[DRY-RUN] Would unset tenantId on ${count} ${name} documents`);
        continue;
      }

      const result = await Model.updateMany(
        { tenantId: tenant.tenantId },
        { $unset: { tenantId: '', tenant: '' } }
      );
      this.log(`${name}: removed tenantId from ${result.modifiedCount} documents`);
    }

    if (!DRY_RUN) {
      await TenantUser.deleteMany({ tenantId: tenant.tenantId });
      await Tenant.deleteOne({ _id: tenant._id });
      this.log('Removed legacy Tenant and TenantUser records');
    } else {
      this.log('[DRY-RUN] Would remove legacy Tenant and TenantUser records');
    }
  }

  async run() {
    await this.connect();

    try {
      if (VALIDATE_ONLY) {
        await this.validate();
        return;
      }

      if (ROLLBACK) {
        await this.rollback();
        return;
      }

      this.log(`Migration mode: ${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'}`);

      const tenant = await this.ensureLegacyTenant();

      this.stats.loanMappingsUpdated = await this.backfillCollection({
        name: 'LoanMapping',
        Model: LoanMapping,
        tenant
      });

      this.stats.messageLogsUpdated = await this.backfillCollection({
        name: 'MessageLog',
        Model: MessageLog,
        tenant
      });

      this.stats.auditLogsUpdated = await this.backfillCollection({
        name: 'AuditLog',
        Model: AuditLog,
        tenant,
        extraFilter: { action: { $ne: 'system_event' } }
      });

      this.stats.productsUpdated = await this.backfillCollection({
        name: 'Product',
        Model: Product,
        tenant
      });

      this.stats.notificationsUpdated = await this.backfillCollection({
        name: 'Notification',
        Model: Notification,
        tenant
      });

      await this.createLegacyTenantUsers(tenant);

      if (!DRY_RUN) {
        await this.validate();
      }

      this.log('Migration summary:');
      console.log(JSON.stringify(this.stats, null, 2));
    } catch (error) {
      this.stats.errors.push(error.message);
      this.log(error.message, 'error');
      if (!CONTINUE_ON_ERROR) throw error;
    } finally {
      await this.disconnect();
    }
  }
}

if (require.main === module) {
  new MultiTenancyMigration()
    .run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = MultiTenancyMigration;
