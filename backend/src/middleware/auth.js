// JWT authentication + role-based authorisation middleware.
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Authentication token missing.'));
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch (e) {
    next(new ApiError(401, 'Invalid or expired token.'));
  }
}

// Usage: authorize('ADMIN','APPROVER')
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission for this action.'));
    }
    next();
  };
}
module.exports = { authenticate, authorize };
