/**
 * ApiError — added here because apiKeyGuard.js already does
 * `const { ApiError } = require('./errorHandler')`, but this file never
 * actually defined/exported it. That import was silently resolving to
 * undefined, so `new ApiError(401, '...')` would have thrown a
 * "ApiError is not a constructor" TypeError the first time apiKeyGuard
 * ever needed to reject a request. Controllers below (procurementController.js)
 * also use this — `throw new ApiError(404, 'Not found')` — and errorHandler()
 * now reads `err.statusCode` first so that status code actually reaches
 * the response instead of always falling back to 500.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function notFound(req, res, next) {
  const error = new Error(`Resource not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
}

module.exports = { notFound, errorHandler, ApiError };