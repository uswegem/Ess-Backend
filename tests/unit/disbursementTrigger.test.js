jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return Object.assign(jest.fn(), { create: actual.create.bind(actual), post: jest.fn() });
});
jest.mock('../../src/utils/signatureUtils', () => ({ createSignedXML: jest.fn(() => '<Document>signed</Document>') }));

const axios = require('axios');
const LoanMapping = require('../../src/models/LoanMapping');
const LoanMappingService = require('../../src/services/loanMappingService');
const loanStatusController = require('../../src/controllers/loanStatusController');
const outgoingMessagesController = require('../../src/controllers/outgoingMessagesController');
const messageAudit = require('../../src/services/messageAudit');
const { parseEssStatus } = require('../../src/services/essStatusService');

const reply = (description, code = '8000') => `<Document><Data><MessageDetails><ResponseCode>${code}</ResponseCode><Description>${description}</Description></MessageDetails></Data></Document>`;
const AWAITING = 'Status : SUBMITTED_FOR_DISBURSEMENT, Description : Loan application was submitted for disbursement';
const tenant = { tenantId: 'legacy-zedone' };
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const hoursAgo = (h) => new Date(Date.now() - h * 3600000);

const createLoan = (extra = {}) => LoanMapping.collection.insertOne({
  tenantId: 'legacy-zedone', essApplicationNumber: 'ESS1', essLoanNumberAlias: 'LOAN1', productCode: '17',
  requestedAmount: 705330.5, tenure: 60, status: 'DISBURSED', disbursedAt: new Date('2026-11-03T06:42:43Z'),
  updatedAt: new Date('2026-11-19T00:00:00Z'),
  metadata: { finalApprovalDetails: { fspReferenceNumber: 'FSP & 1', loanNumber: 'LOAN1' } }, ...extra
});
const suggestions = () => LoanMappingService.getSuggestedMessages('ESS1', 'legacy-zedone');
const disbursement = async () => (await suggestions()).suggested.find((s) => s.messageType === 'LOAN_DISBURSEMENT_NOTIFICATION');
const checkStatus = (description, code) => {
  axios.post.mockResolvedValueOnce({ status: 200, data: reply(description, code) });
  return loanStatusController.triggerLoanStatusRequest({ body: { ApplicationNumber: 'ESS1' }, tenant }, response());
};

afterEach(async () => { await messageAudit.flush(); jest.restoreAllMocks(); });

describe('ESS status', () => {
  test.each([
    [reply(AWAITING), 'SUBMITTED_FOR_DISBURSEMENT'],
    [reply('Status : COMPLETED, Description : done'), 'COMPLETED'],
    [reply(AWAITING, '8005'), null],
    [reply('Loan not found'), null],
    ['', null]
  ])('is read only from a successful status reply', (xml, expected) => {
    expect(parseEssStatus(xml)).toBe(expected);
  });

  test('a status request saves it without touching our status or updatedAt', async () => {
    await createLoan();
    await checkStatus(AWAITING);
    const loan = await LoanMapping.findOne().lean();
    expect(loan).toMatchObject({ essStatus: 'SUBMITTED_FOR_DISBURSEMENT', status: 'DISBURSED' });
    expect(loan.essStatusCheckedAt).toBeInstanceOf(Date);
    expect(loan.updatedAt).toEqual(new Date('2026-11-19T00:00:00Z'));
  });

  test('an unusable reply keeps the previous answer', async () => {
    await createLoan({ essStatus: 'COMPLETED', essStatusCheckedAt: hoursAgo(1) });
    await checkStatus(AWAITING, '8005');
    expect((await LoanMapping.findOne().lean()).essStatus).toBe('COMPLETED');
  });

  test('a save failure does not fail the status request', async () => {
    jest.spyOn(LoanMapping, 'updateOne').mockRejectedValue(new Error('db down'));
    axios.post.mockResolvedValueOnce({ status: 200, data: reply(AWAITING) });
    const res = response();
    await loanStatusController.triggerLoanStatusRequest({ body: { ApplicationNumber: 'ESS1' }, tenant }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('disbursement notification suggestion', () => {
  const awaiting = (extra) => createLoan({ essStatus: 'SUBMITTED_FOR_DISBURSEMENT', essStatusCheckedAt: hoursAgo(1), ...extra });

  test('appears with confirmation and values from the loan', async () => {
    await awaiting();
    const suggestion = await disbursement();
    expect(suggestion.requiresConfirmation).toBe(true);
    expect(suggestion.messageDetails).toContain('<ApplicationNumber>ESS1</ApplicationNumber>');
    expect(suggestion.messageDetails).toContain('<FSPReferenceNumber>FSP &amp; 1</FSPReferenceNumber>');
    expect(suggestion.messageDetails).toContain('<LoanNumber>LOAN1</LoanNumber>');
    expect(suggestion.messageDetails).toContain('<TotalAmountToPay>705330.5</TotalAmountToPay>');
    expect(suggestion.messageDetails).toMatch(/<DisbursementDate>2026-11-03T\d\d:42:43<\/DisbursementDate>/);
  });

  test.each([
    ['the answer is older than 24 hours', { essStatusCheckedAt: hoursAgo(25) }],
    ['Utumishi reports it completed', { essStatus: 'COMPLETED' }],
    ['it was never checked', { essStatus: undefined, essStatusCheckedAt: undefined }],
    ['we have not disbursed it', { status: 'FAILED' }],
    ['there is no disbursement date', { disbursedAt: undefined }],
    ['it was notified after the check', { essDisbursementNotifiedAt: hoursAgo(0.5) }]
  ])('is absent when %s', async (name, extra) => {
    await awaiting(extra);
    expect(await disbursement()).toBeUndefined();
  });

  const send = () => outgoingMessagesController.triggerOutgoingMessage({
    body: { MessageType: 'LOAN_DISBURSEMENT_NOTIFICATION', MessageDetails: '<ApplicationNumber>ESS1</ApplicationNumber>' }, tenant
  }, response());

  test('disappears after an accepted send and returns if a later check still awaits it', async () => {
    await awaiting();
    axios.post.mockResolvedValueOnce({ status: 200, data: reply('Received') });
    await send();
    expect(await disbursement()).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await checkStatus(AWAITING);
    expect(await disbursement()).toBeDefined();
  });

  test('stays when Utumishi rejects the notification', async () => {
    await awaiting();
    axios.post.mockResolvedValueOnce({ status: 200, data: reply('Invalid', '8005') });
    await send();
    expect(await disbursement()).toBeDefined();
  });
});
