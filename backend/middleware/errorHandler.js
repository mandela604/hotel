function errorHandler(err, req, res, _next) {
  console.error('[error]', err.message);
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value', field: Object.keys(err.keyPattern) });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}

function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };
