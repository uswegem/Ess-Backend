const { sendValidationError } = require('../utils/apiResponse');

function formatJoiErrors(error) {
  return error.details.map((detail) => ({
    field: detail.path.join('.') || 'body',
    message: detail.message.replace(/"/g, '')
  }));
}

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return sendValidationError(res, formatJoiErrors(error));
    }

    req.body = value;
    return next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return sendValidationError(res, formatJoiErrors(error));
    }

    req.query = value;
    return next();
  };
}

module.exports = {
  validateBody,
  validateQuery,
  formatJoiErrors
};
