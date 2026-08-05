const { ApiError } = require('./errorHandler');

// If API_KEY is set in the environment, require it on write requests
// (POST/PUT/PATCH/DELETE) via an `x-api-key` header. Leave API_KEY blank
// during local development to disable this check entirely.
module.exports = function apiKeyGuard(req, res, next) {
  const required = process.env.API_KEY;
  if (!required) return next();

  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isWrite) return next();

  const provided = req.header('x-api-key');
  if (provided !== required) {
    return next(new ApiError(401, 'Missing or invalid x-api-key header'));
  }
  next();
};
