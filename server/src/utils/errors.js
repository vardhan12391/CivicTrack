/**
 * Central error handling.
 * - Known operational errors (ApiError) are surfaced to the client.
 * - Anything else is logged server-side and reported generically so we never
 *   leak database internals, stack traces, or connection strings.
 */

class ApiError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) { return new ApiError(400, message, 'VALIDATION_ERROR', details); }
  static unauthorized(message = 'You must be signed in.') { return new ApiError(401, message, 'UNAUTHENTICATED'); }
  static forbidden(message = 'You do not have permission to do that.') { return new ApiError(403, message, 'FORBIDDEN'); }
  static notFound(message = 'Not found.') { return new ApiError(404, message, 'NOT_FOUND'); }
  static conflict(message, details) { return new ApiError(409, message, 'CONFLICT', details); }
}

/** Wrap async route handlers so thrown errors reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Express 404 handler for unknown API routes. */
function notFoundHandler(req, res, next) {
  if (res.headersSent) return next();
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' } });
}

/** Global error middleware. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Mongoose validation errors → 400 with details
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ error: { message: 'Validation failed.', code: 'VALIDATION_ERROR', details } });
  }
  // Bad ObjectId casts → 404
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(404).json({ error: { message: 'Invalid or missing id.', code: 'NOT_FOUND' } });
  }
  // Duplicate key → 409
  if (err.code === 11000) {
    return res.status(409).json({
      error: { message: 'A record with the same unique value already exists.', code: 'CONFLICT', details: err.keyValue },
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
  }

  // Multer file-size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: { message: 'Image too large (max 5 MB).', code: 'VALIDATION_ERROR' } });
  }

  console.error('[error]', err);
  res.status(500).json({ error: { message: 'Something went wrong on the server.', code: 'INTERNAL_ERROR' } });
}

module.exports = { ApiError, asyncHandler, notFoundHandler, errorHandler };
