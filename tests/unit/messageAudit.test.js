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
const messageAudit = require('../../src/services/messageAudit');
const { sendCallback } = require('../../src/utils/callbackUtils');
const { runWithTenantContext } = require('../../src/utils/tenantContext');

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
