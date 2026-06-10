const logger = require('./logger');
const { trackLoanMessage } = require('../middleware/metricsMiddleware');

const xml2js = require('xml2js');
const digitalSignature = require('./signatureUtils');

const builder = new xml2js.Builder({
  rootName: 'Document',
  renderOpts: { pretty: false }
});

function createSignedResponse(responseCode, description, additionalData = {}) {
  // Sanitize description to escape XML special characters
  const sanitizedDescription = String(description || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, ' ')  // Replace newlines with spaces
    .replace(/\r/g, '')   // Remove carriage returns
    .trim();

  const responseObj = {
    Header: {
      Sender: 'ZE DONE',
      Receiver: 'ESS_UTUMISHI',
      FSPCode: 'FL8090',
      MsgId: generateMessageId(),
      MessageType: 'RESPONSE'
    },
    MessageDetails: {
      ResponseCode: responseCode,
      Description: sanitizedDescription,
      ...additionalData
    }
  };

  return digitalSignature.createSignedXML(responseObj);
}

function generateMessageId() {
  return `ESS${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
}

function createSuccessResponse(description = 'Success', additionalData = {}) {
  return createSignedResponse('8000', description, additionalData);
}

function createErrorResponse(responseCode, description) {
  return createSignedResponse(responseCode, description);
}

// Legacy functions for backward compatibility
function createResponse(responseCode, description, additionalData = {}) {
  return createSignedResponse(responseCode, description, additionalData);
}

function sendErrorResponse(res, responseCode, description, format = 'xml', parsedData = null) {
  // Sanitize description to escape XML special characters
  const sanitizedDescription = String(description || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, ' ')  // Replace newlines with spaces
    .replace(/\r/g, '')   // Remove carriage returns
    .trim();

  const errorResponse = {
    Header: {
      Sender: process.env.FSP_NAME || 'ZE DONE',
      Receiver: 'ESS_UTUMISHI',
      FSPCode: process.env.FSP_CODE || 'FL8090',
      MsgId: generateMessageId(),
      MessageType: 'RESPONSE'
    },
    MessageDetails: {
      ResponseCode: responseCode,
      Description: sanitizedDescription
    }
  };

  // Track outgoing error response
  trackLoanMessage('ERROR_RESPONSE', 'sent');

  if (format === 'json') {
    return res.status(400).json(errorResponse);
  } else {
    const signedXml = digitalSignature.createSignedXML(errorResponse);
    res.set('Content-Type', 'application/xml');
    return res.status(400).send(signedXml);
  }
}

module.exports = {
  createResponse,
  createSignedResponse,
  createSuccessResponse,
  createErrorResponse,
  generateMessageId,
  sendErrorResponse
};