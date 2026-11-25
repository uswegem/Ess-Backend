const express = require('express');
const request = require('supertest');

jest.mock('../../src/controllers/apiController', () => ({
  processRequest: jest.fn(),
  handleMifosWebhook: jest.fn()
}));
// only the bare axios(config) call used by sendCallback is mocked
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return Object.assign(jest.fn(), { create: actual.create.bind(actual), post: jest.fn() });
});
jest.mock('../../src/utils/signatureUtils', () => ({
  createSignedXML: jest.fn(() => '<Document>signed</Document>')
}));

const axios = require('axios');
const apiController = require('../../src/controllers/apiController');
const apiRouter = require('../../src/routes/api');
const reportingRouter = require('../../src/routes/internalReporting');
const MessageLog = require('../../src/models/MessageLog');
const PossibleLoanCharges = require('../../src/models/PossibleLoanCharges');
const messageAudit = require('../../src/services/messageAudit');
const { sendCallback } = require('../../src/utils/callbackUtils');
const { runWithTenantContext } = require('../../src/utils/tenantContext');
const LoanMapping = require('../../src/models/LoanMapping');
const AuditLog = require('../../src/models/AuditLog');
const loanStatusController = require('../../src/controllers/loanStatusController');
const handleMifosWebhook = require('../../src/controllers/handlers/mifosWebhookHandler');

const INCOMING = [
  'LOAN_CHARGES_REQUEST', 'LOAN_OFFER_REQUEST', 'TOP_UP_OFFER_REQUEST', 'LOAN_TAKEOVER_OFFER_REQUEST',
  'LOAN_RESTRUCTURE_REQUEST', 'LOAN_FINAL_APPROVAL_NOTIFICATION', 'LOAN_CANCELLATION_NOTIFICATION',
  'TAKEOVER_DISBURSEMENT_NOTIFICATION', 'A_FUTURE_MESSAGE_TYPE'
];
const OUTGOING = [
  'LOAN_INITIAL_APPROVAL_NOTIFICATION', 'LOAN_DISBURSEMENT_NOTIFICATION',
  'LOAN_DISBURSEMENT_FAILURE_NOTIFICATION', 'LOAN_LIQUIDATION_NOTIFICATION'
];

const app = express();
app.use(express.raw({ type: ['application/xml'] }));
app.use((req, res, next) => { req.tenant = { tenantId: 'legacy-zedone' }; req.correlationId = 'corr-1'; next(); });
app.use('/api', apiRouter);

const xml = (type, id = `msg-${type}`) => `<Document><Data><Header><Sender>ESS_UTUMISHI</Sender><Receiver>ZE DONE</Receiver><FSPCode>FL8090</FSPCode><MsgId>${id}</MsgId><MessageType>${type}</MessageType></Header><MessageDetails><ApplicationNumber>ESS1</ApplicationNumber><CheckNumber>113</CheckNumber><RequestedAmount>5000</RequestedAmount></MessageDetails></Data></Document>`;
const post = (type, id) => request(app).post('/api/loan').set('Content-Type', 'application/xml').send(xml(type, id));
const reply = (code) => (req, res) => res.status(200).send(`<Document><ResponseCode>${code}</ResponseCode><Description>desc ${code}</Description></Document>`);
const callback = (type) => ({ Data: { Header: { MsgId: `out-${type}`, MessageType: type }, MessageDetails: { ApplicationNumber: 'ESS1', LoanNumber: 'LN1' } } });

beforeEach(() => { apiController.processRequest.mockImplementation(reply('8000')); });
afterEach(async () => { await messageAudit.flush(); jest.restoreAllMocks(); });

describe('incoming messages', () => {
  test.each(INCOMING)('%s is logged and completed', async (type) => {
    await post(type).expect(200);
    await messageAudit.flush();

    const logs = await MessageLog.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      tenantId: 'legacy-zedone', messageType: type, direction: 'incoming', status: 'completed',
      applicationNumber: 'ESS1', checkNumber: '113', correlationId: 'corr-1', messageId: `msg-${type}`
    });
    expect(logs[0].createdAt).toBeInstanceOf(Date);
    expect(logs[0].updatedAt).toBeInstanceOf(Date);
  });

  test('is "received" while the handler is still working, then updates the same document', async () => {
    let release;
    let entered;
    const inHandler = new Promise((resolve) => { entered = resolve; });
    apiController.processRequest.mockImplementation((req, res) => { release = () => reply('8000')(req, res); entered(); });

    const response = post('LOAN_OFFER_REQUEST').then((r) => r);
    await inHandler;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await messageAudit.flush();
    const before = await MessageLog.findOne().lean();
    expect(before.status).toBe('received');

    release();
    await response;
    await messageAudit.flush();
    const after = await MessageLog.find().lean();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ _id: before._id, status: 'completed' });
  });

  test('an error ResponseCode marks the log failed with its description', async () => {
    apiController.processRequest.mockImplementation(reply('8005'));
    await post('LOAN_OFFER_REQUEST');
    await messageAudit.flush();
    expect(await MessageLog.findOne().lean()).toMatchObject({ status: 'failed', errorMessage: 'desc 8005' });
  });

  test('a repeated MsgId does not create a second entry', async () => {
    await post('LOAN_OFFER_REQUEST', 'same');
    await post('LOAN_OFFER_REQUEST', 'same');
    await messageAudit.flush();
    expect(await MessageLog.countDocuments()).toBe(1);
  });

  let releaseHungWrite;
  test.each([
    ['rejects', () => Promise.reject(new Error('db down'))],
    ['throws', () => { throw new Error('db down'); }],
    ['hangs', () => new Promise((resolve) => { const previous = releaseHungWrite; releaseHungWrite = () => { previous?.(); resolve(); }; })]
  ])('the handler still responds when the log write %s', async (name, brokenWrite) => {
    jest.spyOn(MessageLog, 'updateOne').mockImplementation(brokenWrite);
    const res = await post('LOAN_OFFER_REQUEST', `broken-${name}`).expect(200);
    expect(res.text).toContain('8000');
    expect(apiController.processRequest).toHaveBeenCalled();
    // let queued hung writes finish so they do not leak into later tests
    for (let i = 0; i < 3; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      releaseHungWrite?.();
      releaseHungWrite = undefined;
    }
  });
});

describe('outgoing messages', () => {
  test.each(OUTGOING)('%s is logged and completed', async (type) => {
    await runWithTenantContext({ tenantId: 'legacy-zedone' }, () => sendCallback(callback(type)));
    await messageAudit.flush();
    const logs = await MessageLog.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ tenantId: 'legacy-zedone', messageType: type, direction: 'outgoing', status: 'completed', loanNumber: 'LN1' });
  });

  test('a delivery failure is recorded and still thrown to the caller', async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    axios.mockRejectedValue(new Error('ESS unreachable'));
    try {
      await expect(sendCallback(callback('LOAN_DISBURSEMENT_NOTIFICATION'))).rejects.toThrow('ESS unreachable');
    } finally {
      process.env.NODE_ENV = env;
    }
    await messageAudit.flush();
    expect(await MessageLog.findOne().lean()).toMatchObject({
      status: 'failed', errorMessage: 'ESS unreachable', xmlPayload: '<Document>signed</Document>'
    });
  }, 20000);

  test('delivery succeeds when logging fails', async () => {
    jest.spyOn(MessageLog, 'updateOne').mockImplementation(() => { throw new Error('db down'); });
    await expect(sendCallback(callback('LOAN_INITIAL_APPROVAL_NOTIFICATION'))).resolves.toMatchObject({ status: 200 });
  });
});

describe('other outgoing senders', () => {
  test('the manual loan status request is logged', async () => {
    axios.post.mockResolvedValue({ status: 200, data: '<ResponseCode>8000</ResponseCode>' });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await loanStatusController.triggerLoanStatusRequest({ body: { ApplicationNumber: 'ESS1' }, tenant: { tenantId: 'legacy-zedone' } }, res);
    await messageAudit.flush();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(await MessageLog.findOne().lean()).toMatchObject({ messageType: 'LOAN_STATUS_REQUEST', direction: 'outgoing', status: 'completed', applicationNumber: 'ESS1' });
  });

  test('the restructure initial approval from the Mifos webhook is logged', async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    axios.post.mockResolvedValue({ status: 200, data: '<ResponseCode>8000</ResponseCode>' });
    jest.spyOn(LoanMapping, 'findOne').mockResolvedValue({ _id: 'x', tenantId: 'legacy-zedone', essApplicationNumber: 'ESS1', pendingCallback: {} });
    jest.spyOn(LoanMapping, 'updateOne').mockResolvedValue({});
    try {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
      await handleMifosWebhook({ body: { entityName: 'RESCHEDULELOAN', actionName: 'APPROVE', entity: { id: 1, loanId: 2 } }, headers: {}, get: () => undefined }, res);
      for (let i = 0; i < 40 && !axios.post.mock.calls.length; i += 1) await new Promise((resolve) => setTimeout(resolve, 25));
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      process.env.NODE_ENV = env;
    }
    await messageAudit.flush();
    expect(await MessageLog.findOne().lean()).toMatchObject({ messageType: 'LOAN_INITIAL_APPROVAL_NOTIFICATION', direction: 'outgoing', status: 'completed', applicationNumber: 'ESS1' });
    // both audit entries are valid, and the loan update after them is reached
    const audits = await AuditLog.find({ resource: 'MIFOS_WEBHOOK' }).lean();
    expect(audits.map((a) => a.description).sort()).toEqual(['LOAN_INITIAL_APPROVAL_SENT', 'LOAN_RESTRUCTURE_APPROVED']);
    expect(audits[0]).toMatchObject({ tenantId: 'legacy-zedone', actorType: 'system', status: 'success' });
    expect(LoanMapping.updateOne).toHaveBeenCalled();
  });
});

describe('failure after the acknowledgment', () => {
  const mapping = (status) => ({ tenantId: 'legacy-zedone', essApplicationNumber: 'ESS1', productCode: '17', requestedAmount: 1000, tenure: 12, status });
  const settle = async () => { await new Promise((resolve) => setTimeout(resolve, 50)); await messageAudit.flush(); };

  beforeEach(async () => {
    await post('LOAN_FINAL_APPROVAL_NOTIFICATION');
    await post('LOAN_OFFER_REQUEST');
    await messageAudit.flush();
  });
  const statusOf = async (type) => (await MessageLog.findOne({ messageType: type }).lean()).status;

  test('saving a FAILED loan fails only the final approval log', async () => {
    await new LoanMapping({ ...mapping('FAILED'), metadata: { loanCreationFailure: { message: 'no tenure' } } }).save();
    await settle();
    expect(await MessageLog.findOne({ messageType: 'LOAN_FINAL_APPROVAL_NOTIFICATION' }).lean()).toMatchObject({ status: 'failed', errorMessage: 'no tenure' });
    expect(await statusOf('LOAN_OFFER_REQUEST')).toBe('completed');
  });

  test('updating a loan to FAILED does the same', async () => {
    await new LoanMapping(mapping('FINAL_APPROVAL_RECEIVED')).save();
    await LoanMapping.findOneAndUpdate({ essApplicationNumber: 'ESS1' }, { status: 'FAILED' }, { new: true });
    await settle();
    expect(await statusOf('LOAN_FINAL_APPROVAL_NOTIFICATION')).toBe('failed');
  });

  test('other loan statuses leave the log alone, and a log error does not fail the save', async () => {
    await new LoanMapping(mapping('DISBURSED')).save();
    await settle();
    expect(await statusOf('LOAN_FINAL_APPROVAL_NOTIFICATION')).toBe('completed');

    jest.spyOn(MessageLog, 'findOneAndUpdate').mockRejectedValue(new Error('db down'));
    await expect(LoanMapping.findOneAndUpdate({ essApplicationNumber: 'ESS1' }, { status: 'FAILED' }, { new: true })).resolves.toMatchObject({ status: 'FAILED' });
    await settle();
  });
});

describe('reporting endpoints', () => {
  test.each([
    ['/loan-request', 'LOAN_OFFER_REQUEST'],
    ['/hr-approval', 'LOAN_FINAL_APPROVAL_NOTIFICATION']
  ])('%s returns the logged message with dashboard columns', async (path, type) => {
    await post(type);
    await messageAudit.flush();
    const layer = reportingRouter.stack.find((l) => l.route?.path === path);
    const body = await new Promise((resolve, reject) => {
      layer.route.stack[0].handle({ tenant: { tenantId: 'legacy-zedone' }, query: {} }, { json: resolve }, reject);
    });
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({ message_type: type, request_type: type, check_number: '113', application_number: 'ESS1', requested_amount: 5000, status: 'completed' });
  });
});

describe('summary_rows', () => {
  const call = (path, query = {}) => new Promise((resolve, reject) => {
    const layer = reportingRouter.stack.find((l) => l.route?.path === path);
    layer.route.stack[0].handle({ tenant: { tenantId: 'legacy-zedone' }, query }, { json: resolve }, reject);
  });
  const log = (messageType, status, extra = {}) => ({ tenantId: 'legacy-zedone', messageId: `${messageType}-${status}-${Math.random()}`, messageType, status, xmlPayload: '<x/>', ...extra });

  test('groups by message type, maps statuses and keeps the old summary', async () => {
    await MessageLog.create([
      log('LOAN_DISBURSEMENT_NOTIFICATION', 'sent'), log('LOAN_DISBURSEMENT_NOTIFICATION', 'completed'),
      log('LOAN_DISBURSEMENT_NOTIFICATION', 'pending'), log('TAKEOVER_DISBURSEMENT_NOTIFICATION', 'received'),
      log('TAKEOVER_DISBURSEMENT_NOTIFICATION', 'failed'), log('LOAN_DISBURSEMENT_NOTIFICATION', 'sent', { tenantId: 'other' })
    ]);
    const body = await call('/disbursement');
    expect(body.summary).toEqual({ count: 5, by_status: { sent: 1, completed: 1, pending: 1, received: 1, failed: 1 } });
    expect(body.summary_rows).toEqual([
      { category: 'LOAN_DISBURSEMENT_NOTIFICATION', pending: 1, completed: 2, approved: 0, rejected: 0, failed: 0 },
      { category: 'TAKEOVER_DISBURSEMENT_NOTIFICATION', pending: 1, completed: 0, approved: 0, rejected: 0, failed: 1 }
    ]);
  });

  test('splits completed approvals into approved and rejected', async () => {
    const type = 'LOAN_FINAL_APPROVAL_NOTIFICATION';
    await MessageLog.create([
      log(type, 'completed', { metadata: { approval: 'APPROVED' } }), log(type, 'completed', { metadata: { approval: 'REJECTED' } }),
      log(type, 'completed'), log(type, 'failed', { metadata: { approval: 'APPROVED' } })
    ]);
    expect((await call('/hr-approval')).summary_rows).toEqual([
      { category: type, pending: 0, completed: 3, approved: 1, rejected: 1, failed: 1 }
    ]);
  });

  test.each(['/loan-request', '/loan-offer', '/hr-approval', '/disbursement', '/liquidation'])('%s returns an empty list without data', async (path) => {
    expect((await call(path, { from: '2026-01-01T00:00:00Z' })).summary_rows).toEqual([]);
  });

  test('possible loan charges group by product and respect the date range', async () => {
    const base = { tenantId: 'legacy-zedone', productName: 'Product A', createdAt: new Date('2026-11-20') };
    await PossibleLoanCharges.collection.insertMany([
      { ...base, status: 'COMPLETED' }, { ...base, status: 'FAILED' }, { ...base, status: 'PENDING', productName: 'Product B' },
      { ...base, status: 'COMPLETED', createdAt: new Date('2026-01-01') }
    ]);
    const body = await call('/possible-loan-charges', { from: '2026-11-01T00:00:00Z' });
    expect(body.summary.count).toBe(3);
    expect(body.rows).toHaveLength(3);
    expect(body.summary_rows).toEqual([
      { category: 'Product A', pending: 0, completed: 1, approved: 0, rejected: 0, failed: 1 },
      { category: 'Product B', pending: 1, completed: 0, approved: 0, rejected: 0, failed: 0 }
    ]);
  });
});

describe('pipeline health (alert query)', () => {
  const health = () => new Promise((resolve, reject) => {
    const layer = reportingRouter.stack.find((l) => l.route?.path === '/pipeline-health');
    layer.route.stack[0].handle({ tenant: { tenantId: 'legacy-zedone' }, query: {} }, { json: (body) => resolve(body.rows[0]) }, reject);
  });
  const charge = (hoursAgo, tenantId = 'legacy-zedone') => PossibleLoanCharges.collection.insertOne({ tenantId, createdAt: new Date(Date.now() - hoursAgo * 3600000) });
  const request = (extra = {}) => MessageLog.create({ tenantId: 'legacy-zedone', messageId: `r${Math.random()}`, messageType: 'LOAN_OFFER_REQUEST', xmlPayload: '<x/>', ...extra });

  test('is quiet without recent charges for this tenant', async () => {
    await charge(30);
    await charge(1, 'other');
    expect(await health()).toMatchObject({ charges: 0, loan_requests: 0, firing: 0 });
  });

  test('fires on charges without a logged loan request, ignoring backfilled ones', async () => {
    await charge(1);
    await request({ source: 'backfill' });
    expect(await health()).toMatchObject({ tenant_id: 'legacy-zedone', charges: 1, loan_requests: 0, firing: 1 });
    await request();
    expect(await health()).toMatchObject({ loan_requests: 1, firing: 0 });
  });
});
