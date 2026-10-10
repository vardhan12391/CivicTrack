const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
const { ApiError, asyncHandler } = require('../utils/errors');
const { signToken, setAuthCookies, clearAuthCookies, CSRF_COOKIE, CSRF_HEADER } = require('../utils/token');
const { writeAudit } = require('../services/auditService');

/** Shape the user object the frontend is allowed to see. */
function publicUser(user, department) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: department || user.departmentId || null,
    createdAt: user.createdAt,
  };
}

/**
 * POST /api/auth/register
 * Public registration always creates a CITIZEN. Role escalation via this
 * endpoint is impossible; officials are provisioned by an administrator.
 */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) throw ApiError.badRequest('name, email and password are required.');
  if (String(password).length < 8) throw ApiError.badRequest('Password must be at least 8 characters.');

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) throw ApiError.conflict('An account with this email already exists.');

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash,
    role: 'citizen',
  });

  await writeAudit({
    actor: { _id: user._id, role: user.role },
    entityType: 'user',
    entityId: user._id,
    action: 'user.registered',
    newValues: { email: user.email, role: user.role },
  });

  setAuthCookies(res, signToken(user));
  res.status(201).json({ user: publicUser(user) });
});

/** POST /api/auth/login */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw ApiError.badRequest('Email and password are required.');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
  // Same message for "no such user" and "wrong password" — no user enumeration.
  if (!user || !user.isActive) throw ApiError.unauthorized('Invalid email or password.');
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password.');

  const department = user.departmentId ? await Department.findById(user.departmentId).lean() : null;
  setAuthCookies(res, signToken(user));
  res.json({ user: publicUser(user, department) });
});

/** POST /api/auth/logout */
exports.logout = asyncHandler(async (_req, res) => {
  clearAuthCookies(res);
  res.json({ message: 'Signed out.' });
});

/** GET /api/auth/me */
exports.me = asyncHandler(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: { message: 'Not signed in.', code: 'UNAUTHENTICATED' } });
  if (req.cookies?.[CSRF_COOKIE]) {
    res.set(CSRF_HEADER, req.cookies[CSRF_COOKIE]);
  }
  res.json({ user: req.user });
});
