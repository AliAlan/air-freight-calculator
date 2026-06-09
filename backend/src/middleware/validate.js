// Validates req.body against a Zod schema; attaches parsed data to req.body.
const ApiError = require('../utils/ApiError');
module.exports = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.'), message: i.message,
    }));
    return next(new ApiError(422, 'Validation failed.', details));
  }
  req.body = result.data;
  next();
};
