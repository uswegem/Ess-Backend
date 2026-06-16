const crypto = require('crypto');

function correlationMiddleware(req, res, next) {
  const incoming = req.get('X-Correlation-Id') || req.get('X-Request-Id');
  req.correlationId = incoming || crypto.randomUUID();
  res.set('X-Correlation-Id', req.correlationId);
  next();
}

module.exports = { correlationMiddleware };
