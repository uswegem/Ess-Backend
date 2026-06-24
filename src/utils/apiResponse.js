function sendSuccess(res, { status = 200, message, data, pagination } = {}) {
  const payload = { success: true };
  if (message) payload.message = message;
  if (data !== undefined) payload.data = data;
  if (pagination) payload.pagination = pagination;
  return res.status(status).json(payload);
}

function sendError(res, status, message, { code, errors, correlationId } = {}) {
  const payload = { success: false, message };
  if (code) payload.code = code;
  if (errors) payload.errors = errors;
  if (correlationId) payload.correlationId = correlationId;
  return res.status(status).json(payload);
}

function sendValidationError(res, errors) {
  return sendError(res, 400, 'Validation failed', { code: 'VALIDATION_ERROR', errors });
}

module.exports = {
  sendSuccess,
  sendError,
  sendValidationError
};
