const LoanMapping = require('../../src/models/LoanMapping');
const MessageLog = require('../../src/models/MessageLog');
const { backfill } = require('../../scripts/backfill-message-logs');

const range = { since: new Date('2026-09-09'), until: new Date('2026-12-01') };

describe('message log backfill', () => {
  beforeEach(async () => {
    await LoanMapping.collection.insertOne({
      tenantId: 'legacy-zedone', essApplicationNumber: 'ESS1', essCheckNumber: '113', productCode: '17',
      requestedAmount: 5000, tenure: 12, status: 'DISBURSED', originalMessageType: 'LOAN_OFFER_REQUEST',
      createdAt: new Date('2026-09-10T08:00:00Z'), updatedAt: new Date('2026-09-11T10:00:00Z'),
      finalApprovalReceivedAt: new Date('2026-09-11T09:00:00Z'), disbursedAt: new Date('2026-09-11T09:00:01Z'),
      metadata: {
        callbacksSent: [{ type: 'LOAN_INITIAL_APPROVAL_NOTIFICATION', status: 'success', sentAt: new Date('2026-09-10T08:01:00Z') }],
        finalApprovalDetails: { approval: 'APPROVED' }
      }
    });
  });

  test('a dry run writes nothing and leaves out inferred entries', async () => {
    const report = await backfill(range);
    expect(report).toMatchObject({ planned: 3, inserted: 0 });
    expect(report.counts['legacy-zedone | LOAN_DISBURSEMENT_NOTIFICATION (inferred)']).toMatchObject({ found: 1, skippedInferred: 1, toInsert: 0 });
    expect(await MessageLog.countDocuments()).toBe(0);
  });

  test('applying keeps event times, marks the source and is idempotent', async () => {
    expect((await backfill({ ...range, apply: true, includeInferred: true })).inserted).toBe(4);
    expect((await backfill({ ...range, apply: true, includeInferred: true })).inserted).toBe(0);
    const logs = await MessageLog.find().sort({ createdAt: 1 }).lean();
    expect(logs).toHaveLength(4);
    expect(logs.every((l) => l.source === 'backfill')).toBe(true);
    expect(logs[0]).toMatchObject({ messageType: 'LOAN_OFFER_REQUEST', direction: 'incoming', status: 'completed', createdAt: new Date('2026-09-10T08:00:00Z') });
  });

  test('skips messages already logged and events outside the window', async () => {
    await MessageLog.create({ tenantId: 'legacy-zedone', messageId: 'live', messageType: 'LOAN_OFFER_REQUEST', applicationNumber: 'ESS1', xmlPayload: '<x/>' });
    const report = await backfill({ ...range, until: new Date('2026-09-11') });
    expect(report.planned).toBe(1);
    expect(report.counts['legacy-zedone | LOAN_OFFER_REQUEST']).toMatchObject({ alreadyLogged: 1 });
  });
});
