#!/usr/bin/env node
/**
 * One-off rebuild of MessageLog entries from LoanMapping for the period before
 * central message logging. Idempotent. Dry run unless --apply is given.
 *
 *   node scripts/backfill-message-logs.js --until=<deploy time, ISO>
 *        [--since=2026-09-09] [--env=/path/to/.env] [--include-inferred] [--apply]
 *
 * Disbursement notifications are "inferred": the loan record shows the
 * disbursement but not whether the notification reached ESS. They are only
 * written with --include-inferred.
 */
const path = require('path');
const mongoose = require('mongoose');
const LoanMapping = require('../src/models/LoanMapping');
const MessageLog = require('../src/models/MessageLog');

const SOURCE = 'backfill';

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

const toDate = (value) => (value && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : null);
const toNumber = (value) => (value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined);

/** The messages a loan record gives evidence for, each at the time it happened. */
function eventsFor(mapping) {
  const meta = mapping.metadata || {};
  const events = [];
  const add = (messageType, direction, time, extra = {}) => {
    const at = toDate(time);
    if (at) events.push({ messageType, direction, at, ...extra });
  };

  if (/_(OFFER_REQUEST|RESTRUCTURE_REQUEST)$|^LOAN_OFFER_REQUEST$/.test(mapping.originalMessageType || '')) {
    add(mapping.originalMessageType, 'incoming', meta.offerReceivedAt || mapping.createdAt);
  }

  // initialOfferSentAt is stamped on receipt, so only a recorded successful send counts
  const sent = (meta.callbacksSent || []).find((c) => c.type === 'LOAN_INITIAL_APPROVAL_NOTIFICATION' && c.status === 'success');
  if (sent) add(sent.type, 'outgoing', sent.sentAt, { approval: 'APPROVED' });

  add('LOAN_FINAL_APPROVAL_NOTIFICATION', 'incoming', mapping.finalApprovalReceivedAt, {
    approval: meta.finalApprovalDetails?.approval,
    reason: meta.finalApprovalDetails?.reason,
    status: mapping.status === 'FAILED' ? 'failed' : 'completed'
  });

  add('LOAN_DISBURSEMENT_NOTIFICATION', 'outgoing', mapping.disbursedAt, { inferred: true });
  return events;
}

function toDocument(mapping, event) {
  const client = mapping.metadata?.clientData || {};
  const loan = mapping.metadata?.loanData || {};
  const outgoing = event.direction === 'outgoing';
  return compact({
    tenantId: mapping.tenantId,
    tenant: mapping.tenant,
    messageId: `BACKFILL_${mapping._id}_${event.messageType}`,
    messageType: event.messageType,
    direction: event.direction,
    status: event.status || 'completed',
    applicationNumber: mapping.essApplicationNumber,
    checkNumber: mapping.essCheckNumber || client.checkNumber,
    loanNumber: mapping.essLoanNumberAlias,
    fspReferenceNumber: mapping.fspReferenceNumber,
    sender: outgoing ? 'ZE DONE' : 'ESS_UTUMISHI',
    receiver: outgoing ? 'ESS_UTUMISHI' : 'ZE DONE',
    sentAt: outgoing ? event.at : undefined,
    createdAt: event.at,
    updatedAt: event.at,
    source: SOURCE,
    metadata: compact({
      checkNumber: mapping.essCheckNumber || client.checkNumber,
      idNumber: client.nin,
      firstName: client.firstName,
      middleName: client.middleName,
      lastName: client.lastName,
      sex: client.sex,
      productCode: mapping.productCode || loan.productCode,
      requestedAmount: toNumber(mapping.requestedAmount ?? loan.requestedAmount),
      requestedTenure: toNumber(mapping.tenure ?? loan.tenure),
      approval: event.approval,
      reason: event.reason,
      inferred: event.inferred
    })
  });
}

/** Builds the entries and, when apply is true, inserts the ones not yet present. */
async function backfill({ since, until, apply = false, includeInferred = false }) {
  const window = { $gte: since, $lt: until };
  const mappings = await LoanMapping.find({
    $or: ['createdAt', 'finalApprovalReceivedAt', 'disbursedAt', 'updatedAt'].map((field) => ({ [field]: window }))
  }).lean();

  const counts = {};
  const documents = [];
  for (const mapping of mappings) {
    for (const event of eventsFor(mapping)) {
      if (event.at < since || event.at >= until) continue;
      const doc = toDocument(mapping, event);
      const key = `${doc.tenantId || '(no tenant)'} | ${doc.messageType}${event.inferred ? ' (inferred)' : ''}`;
      counts[key] = counts[key] || { found: 0, alreadyLogged: 0, toInsert: 0, skippedNoTenant: 0, skippedInferred: 0 };
      counts[key].found += 1;

      if (!doc.tenantId) { counts[key].skippedNoTenant += 1; continue; }
      // either a real log of this message or an earlier backfill run
      const existing = await MessageLog.exists({
        tenantId: doc.tenantId,
        $or: [
          { messageId: doc.messageId },
          { applicationNumber: doc.applicationNumber, messageType: doc.messageType }
        ]
      });
      if (existing) { counts[key].alreadyLogged += 1; continue; }
      if (event.inferred && !includeInferred) { counts[key].skippedInferred += 1; continue; }
      counts[key].toInsert += 1;
      documents.push(doc);
    }
  }

  let inserted = 0;
  if (apply && documents.length) {
    const result = await MessageLog.bulkWrite(documents.map((doc) => ({
      updateOne: {
        filter: { tenantId: doc.tenantId, messageId: doc.messageId },
        update: { $setOnInsert: doc },
        upsert: true,
        timestamps: false // keep the historical createdAt
      }
    })));
    inserted = result.upsertedCount;
  }
  return { loanRecords: mappings.length, counts, planned: documents.length, inserted, documents };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [key, value] = a.replace(/^--/, '').split('=');
    return [key, value === undefined ? true : value];
  }));
  const since = toDate(args.since || '2026-09-09');
  const until = toDate(args.until);
  if (!since || !until) throw new Error('--until=<ISO date> is required (and --since must be a date)');

  require('dotenv').config({ path: path.resolve(args.env || '.env') });
  // a dry run must not write anything, including Mongoose's index creation
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    const report = await backfill({ since, until, apply: args.apply === true, includeInferred: args['include-inferred'] === true });
    console.log(`${args.apply === true ? 'APPLY' : 'DRY RUN (nothing written)'}  ${since.toISOString()} to ${until.toISOString()}`);
    console.log(`Loan records examined: ${report.loanRecords}`);
    console.table(report.counts);
    console.log(`Planned inserts: ${report.planned}   Inserted: ${report.inserted}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}

module.exports = { backfill, eventsFor, toDocument };
