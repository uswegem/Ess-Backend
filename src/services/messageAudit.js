/**
 * Central, non-blocking logging of ESS messages into MessageLog.
 *
 * Incoming messages are logged by the incomingMessageAudit middleware and
 * outgoing ones by sendCallback, so individual handlers need no logging calls.
 * Nothing in here may throw into, or delay, the business flow: writes are
 * fire-and-forget and failures only reach the app logger.
 */
const xml2js = require('xml2js');
const logger = require('../utils/logger');
const MessageLog = require('../models/MessageLog');
const { getMessageId } = require('../utils/messageIdGenerator');
const { getActiveTenantContext } = require('../utils/tenantContext');

const SUCCESS_RESPONSE_CODE = '8000';

// Writes for one message are chained so the final status can never be
// overwritten by a slower initial insert.
const pendingWrites = new Map();

const isEnabled = () => process.env.MESSAGE_LOGGING_ENABLED !== 'false';

function resolveTenantId(tenantId) {
  return tenantId || getActiveTenantContext()?.tenantId || process.env.LEGACY_TENANT_ID || 'legacy-zedone';
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(value) {
  const parsed = Number(text(value) ?? value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : undefined;
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

/** Builds the MessageLog fields from a message's Data node ({ Header, MessageDetails }). */
function describeMessage(data) {
  const header = data?.Header || {};
  const details = data?.MessageDetails || {};
  const messageType = text(header.MessageType);
  if (!messageType) return null;

  return {
    messageType,
    messageId: text(header.MsgId) || getMessageId(messageType),
    fields: compact({
      fspCode: text(header.FSPCode),
      sender: text(header.Sender),
      receiver: text(header.Receiver),
      applicationNumber: text(details.ApplicationNumber),
      checkNumber: text(details.CheckNumber),
      loanNumber: text(details.LoanNumber),
      fspReferenceNumber: text(details.FSPReferenceNumber),
      metadata: compact({
        checkNumber: text(details.CheckNumber),
        idNumber: text(details.NIN),
        firstName: text(details.FirstName),
        middleName: text(details.MiddleName),
        lastName: text(details.LastName),
        sex: text(details.Sex),
        productCode: text(details.ProductCode),
        requestedAmount: number(details.RequestedAmount ?? details.LoanAmount),
        requestedTenure: number(details.RequestedTenure ?? details.Tenure),
        totalAmountToPay: number(details.TotalAmountToPay),
        otherCharges: number(details.OtherCharges),
        approval: text(details.Approval),
        reason: text(details.Reason)
      })
    })
  };
}

function write(entry, update) {
  const key = `${entry.tenantId}|${entry.direction}|${entry.messageId}`;
  const next = (pendingWrites.get(key) || Promise.resolve())
    .then(() => MessageLog.updateOne(
      { tenantId: entry.tenantId, messageId: entry.messageId, direction: entry.direction },
      { $set: update },
      { upsert: true, runValidators: true }
    ))
    .catch((error) => {
      logger.error('Message audit write failed', {
        messageId: entry.messageId,
        messageType: entry.messageType,
        error: error.message
      });
    })
    .finally(() => {
      if (pendingWrites.get(key) === next) pendingWrites.delete(key);
    });
  pendingWrites.set(key, next);
}

/**
 * Records a message as it arrives or is about to be sent.
 * Returns a handle for finish(), or null when nothing was logged.
 */
function start({ data, direction, tenantId, correlationId, xmlPayload }) {
  try {
    if (!isEnabled()) return null;
    const message = describeMessage(data);
    if (!message) return null;

    const entry = {
      tenantId: resolveTenantId(tenantId),
      direction,
      messageId: message.messageId,
      messageType: message.messageType
    };
    write(entry, compact({
      ...message.fields,
      messageType: message.messageType,
      correlationId,
      xmlPayload,
      status: direction === 'incoming' ? 'received' : 'pending'
    }));
    return entry;
  } catch (error) {
    logger.error('Message audit failed to start', { direction, error: error.message });
    return null;
  }
}

function finish(entry, { status, errorMessage, response, xmlPayload }) {
  try {
    if (!entry) return;
    write(entry, compact({
      // messageType is repeated so the document is complete even if the first write failed
      messageType: entry.messageType,
      status,
      errorMessage: errorMessage || null,
      response: response && typeof response !== 'string' ? JSON.stringify(response) : response || undefined,
      xmlPayload,
      sentAt: entry.direction === 'outgoing' ? new Date() : undefined
    }));
  } catch (error) {
    logger.error('Message audit failed to finish', { messageId: entry?.messageId, error: error.message });
  }
}

/** Runs an ESS delivery that does not go through sendCallback, logging its outcome. */
async function trackSend({ data, xmlPayload, tenantId }, send) {
  const entry = start({ data, direction: 'outgoing', tenantId, xmlPayload });
  try {
    const response = await send();
    finish(entry, { ...outcomeOf(response?.status, response?.data), response: response?.data });
    return response;
  } catch (error) {
    finish(entry, { status: 'failed', errorMessage: error.message });
    throw error;
  }
}

/**
 * A final approval is acknowledged before the loan is created, so its log can
 * already read "completed" when the processing fails. Correct it afterwards.
 */
function processingFailed({ tenantId, applicationNumber, errorMessage }) {
  if (!isEnabled() || !applicationNumber) return Promise.resolve();

  const key = `processing|${tenantId}|${applicationNumber}`;
  const next = Promise.all([...pendingWrites.values()])
    .then(() => MessageLog.findOneAndUpdate(
      {
        tenantId: resolveTenantId(tenantId),
        applicationNumber,
        direction: 'incoming',
        messageType: 'LOAN_FINAL_APPROVAL_NOTIFICATION',
        status: { $in: ['received', 'completed'] }
      },
      { $set: { status: 'failed', errorMessage } },
      { sort: { createdAt: -1 } }
    ))
    .catch((error) => {
      logger.error('Message audit processing-failure update failed', { applicationNumber, error: error.message });
    })
    .finally(() => {
      if (pendingWrites.get(key) === next) pendingWrites.delete(key);
    });
  pendingWrites.set(key, next);
  return next;
}

/** Decides completed/failed from an HTTP status and an (optionally XML) response body. */
function outcomeOf(httpStatus, body) {
  const content = typeof body === 'string' ? body : Buffer.isBuffer(body) ? body.toString('utf8') : '';
  const responseCode = content.match(/<ResponseCode>\s*(.*?)\s*<\/ResponseCode>/)?.[1];
  const failed = httpStatus >= 400 || (responseCode !== undefined && responseCode !== SUCCESS_RESPONSE_CODE);
  if (!failed) return { status: 'completed' };

  const description = content.match(/<Description>([\s\S]*?)<\/Description>/)?.[1];
  return {
    status: 'failed',
    errorMessage: description || (responseCode ? `ResponseCode ${responseCode}` : `HTTP ${httpStatus}`)
  };
}

/** Express middleware for the single incoming ESS message route. Never delays next(). */
function incomingMessageAudit(req, res, next) {
  try {
    const xml = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    if (isEnabled() && typeof xml === 'string' && xml.trim().startsWith('<')) {
      const tenantId = resolveTenantId(req.tenant?.tenantId);
      const correlationId = req.correlationId;

      let responseBody;
      const originalSend = res.send;
      res.send = function auditedSend(body) {
        responseBody = body;
        return originalSend.call(this, body);
      };

      const started = xml2js.parseStringPromise(xml, { explicitArray: false })
        .then((parsed) => start({
          data: parsed?.Document?.Data,
          direction: 'incoming',
          tenantId,
          correlationId,
          xmlPayload: xml
        }))
        // Unparseable XML has no messageType to log; the controller rejects it.
        .catch(() => null);

      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        const outcome = res.writableFinished
          ? outcomeOf(res.statusCode, responseBody)
          : { status: 'failed', errorMessage: 'Connection closed before a response was sent' };
        started.then((entry) => finish(entry, { ...outcome, response: Buffer.isBuffer(responseBody) ? responseBody.toString('utf8') : responseBody }));
      };
      res.once('finish', settle);
      res.once('close', settle);
    }
  } catch (error) {
    logger.error('Incoming message audit failed', { error: error.message });
  }
  next();
}

/** Resolves once all queued writes have settled (used by tests). */
async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  while (pendingWrites.size) await Promise.all(pendingWrites.values());
}

module.exports = {
  incomingMessageAudit,
  start,
  finish,
  trackSend,
  processingFailed,
  outcomeOf,
  describeMessage,
  resolveTenantId,
  flush
};
