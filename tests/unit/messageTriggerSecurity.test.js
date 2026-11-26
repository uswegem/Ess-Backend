const express = require('express');
const request = require('supertest');

// authentication is simulated; the role and permission checks are the real ones
jest.mock('../../src/middleware/authMiddleware', () => ({
  ...jest.requireActual('../../src/middleware/authMiddleware'),
  authMiddleware: (req, res, next) => {
    const as = JSON.parse(req.get('X-Test-Auth') || 'null');
    if (!as) return res.status(401).json({ success: false });
    req.user = { role: as.userRole || 'user', username: 'tester' };
    req.authContext = { role: as.role, permissions: as.permissions || [], isSuperAdmin: Boolean(as.superAdmin) };
    return next();
  }
}));
const sent = (req, res) => res.status(200).json({ success: true });
jest.mock('../../src/controllers/outgoingMessagesController', () => ({ triggerOutgoingMessage: jest.fn() }));
jest.mock('../../src/controllers/loanStatusController', () => ({ triggerLoanStatusRequest: jest.fn() }));
jest.mock('../../src/controllers/apiController', () => ({ processRequest: jest.fn(), handleMifosWebhook: jest.fn() }));

const outgoing = require('../../src/controllers/outgoingMessagesController').triggerOutgoingMessage;
const status = require('../../src/controllers/loanStatusController').triggerLoanStatusRequest;
const { SENSITIVE_MANUAL_TRIGGER_MESSAGE_TYPES } = require('../../src/utils/loanConstants');

const app = express();
app.use(express.json());
app.use('/api/v1/loan-actions', require('../../src/routes/loanActions'));
app.use('/api/v1', require('../../src/routes/manualMessageActions'));
app.use('/api', require('../../src/routes/api'));

const operator = (...extra) => ({ role: 'operations_manager', permissions: ['loans:operate', ...extra] });
const trigger = operator('messages:trigger');
const sensitive = operator('messages:trigger', 'messages:trigger_sensitive');
const post = (path, auth, body = {}) => {
  const req = request(app).post(path);
  if (auth) req.set('X-Test-Auth', JSON.stringify(auth));
  return req.send(body);
};
const message = (MessageType) => ({ MessageType, MessageDetails: '<ApplicationNumber>ESS1</ApplicationNumber>' });

beforeEach(() => {
  outgoing.mockReset().mockImplementation(sent);
  status.mockReset().mockImplementation(sent);
});

describe('manual message trigger security', () => {
  test.each(['/api/sign', '/api/loan/disburse'])('the signing and disbursement route %s no longer exists', async (path) => {
    await post(path, null, {}).expect(404);
    await post(path, sensitive, {}).expect(404);
  });

  test.each(['/api/outgoing-message', '/api/loan-status-request'])('the unguarded route %s no longer exists', async (path) => {
    await post(path, null, message('LOAN_DISBURSEMENT_NOTIFICATION')).expect(404);
    await post(path, sensitive, message('LOAN_DISBURSEMENT_NOTIFICATION')).expect(404);
    expect(outgoing).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  test('requires a login, an allowed role and loans:operate', async () => {
    await post('/api/v1/outgoing-message', null, message('FSP_BRANCHES')).expect(401);
    await post('/api/v1/outgoing-message', { role: 'api_key', permissions: ['reporting:read'] }, message('FSP_BRANCHES')).expect(403);
    await post('/api/v1/outgoing-message', { role: 'operations_manager', permissions: ['messages:trigger'] }, message('FSP_BRANCHES')).expect(403);
    expect(outgoing).not.toHaveBeenCalled();
  });

  test('every send requires messages:trigger', async () => {
    await post('/api/v1/outgoing-message', operator(), message('FSP_BRANCHES')).expect(403);
    await post('/api/v1/loan-status-request', operator(), { ApplicationNumber: 'ESS1' }).expect(403);
    await post('/api/v1/outgoing-message', trigger, message('FSP_BRANCHES')).expect(200);
    await post('/api/v1/loan-status-request', trigger, { ApplicationNumber: 'ESS1' }).expect(200);
  });

  test.each([...SENSITIVE_MANUAL_TRIGGER_MESSAGE_TYPES])('%s also requires messages:trigger_sensitive', async (type) => {
    await post('/api/v1/outgoing-message', trigger, message(type)).expect(403);
    await post('/api/v1/outgoing-message', trigger, message(` ${type.toLowerCase()} `)).expect(403);
    expect(outgoing).not.toHaveBeenCalled();
    await post('/api/v1/outgoing-message', sensitive, message(type)).expect(200);
  });

  test('a non-string MessageType cannot slip past the check', async () => {
    await post('/api/v1/outgoing-message', trigger, message(['LOAN_DISBURSEMENT_NOTIFICATION'])).expect(400);
    expect(outgoing).not.toHaveBeenCalled();
  });

  test('platform administrators are unaffected', async () => {
    await post('/api/v1/outgoing-message', { superAdmin: true }, message('LOAN_LIQUIDATION_NOTIFICATION')).expect(200);
  });

  test.each(['send-disbursement-notification', 'send-disbursement-failure'])('loan action %s requires the sensitive permission', async (action) => {
    await post(`/api/v1/loan-actions/${action}`, trigger).expect(403);
    // passes the permission check and stops at input validation
    await post(`/api/v1/loan-actions/${action}`, sensitive).expect(400);
  });

  test('the frontend and backend sensitive lists match', () => {
    const source = require('fs').readFileSync('/opt/ess2/frontend/src/services/messages/messageTypes.js', 'utf8');
    const list = source.match(/SENSITIVE_MESSAGE_TYPES = \[([\s\S]*?)\]/)[1].match(/[A-Z_]{5,}/g);
    expect([...SENSITIVE_MANUAL_TRIGGER_MESSAGE_TYPES].sort()).toEqual(list.sort());
  });
});
