// A typed error so controllers/middleware can set proper HTTP status codes.
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
module.exports = ApiError;
