// Final error handler: turns any thrown error into a consistent JSON envelope.
const ApiError = require('../utils/ApiError');
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, _next) => {
  const status = err instanceof ApiError ? err.statusCode : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    error: { message: err.message || 'Internal server error', details: err.details || null },
  });
};
