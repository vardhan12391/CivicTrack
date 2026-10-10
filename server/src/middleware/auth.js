const { verifyToken, AUTH_COOKIE, CSRF_COOKIE, CSRF_HEADER } = require('../utils/token');
const { ApiError, asyncHandler } = require('../utils/errors');
const User = require('../models/User');

/** Parse the JWT cookie and attach `req.user` (without the password hash). */
const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return next();

  const payload = verifyToken(token);
  if (!payload) return next(); // expired/invalid → treated as anonymous

  const user = await User.findById(payload.sub).populate('departmentId', 'name departmentType');
  if (!user || !user.isActive) return next();

  // The token is issued at login; if the role changed since then we still read
  // the FRESH role from the database. The frontend's claimed role never counts.
  req.user = {
    _id: user._id,
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.departmentId || null,
  };
  next();
});

/**
 * CSRF double-submit check for mutating requests.
 * The frontend echoes the `ct_csrf` cookie in the `x-csrf-token` header.
 * GET/HEAD/OPTIONS are exempt (they must not change state).
 */
function requireCsrf(req, _res, next) {
  const method = (req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  // No CSRF cookie was ever set → the request cannot be a browser session of
  // ours from a cross-site form, so nothing to compare; treat as failure only
  // when a session cookie is present (i.e. an authenticated mutation).
  if (!req.cookies?.[AUTH_COOKIE]) return next();

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(ApiError.forbidden('CSRF check failed. Refresh the page and try again.'));
  }
  next();
}

/** Require an authenticated user. */
function requireAuth(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  next();
}

/** Require one of the given roles. */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires one of these roles: ${roles.join(', ')}.`));
    }
    next();
  };
}

/**
 * Officials may only act within their own department; administrators act
 * anywhere. Used as `requireOwnDepartment(Project)`.
 */
function requireOwnDepartment(Model) {
  return asyncHandler(async (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'administrator') return next();

    const doc = await Model.findById(req.params.id).select('departmentId');
    if (!doc) return next(ApiError.notFound('Not found.'));

    const userDept = req.user.department?._id || req.user.departmentId;
    if (!userDept || String(doc.departmentId) !== String(userDept)) {
      return next(ApiError.forbidden('You can only modify projects belonging to your own department.'));
    }
    next();
  });
}

module.exports = { authenticate, requireCsrf, requireAuth, requireRole, requireOwnDepartment };
