const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

const AUTH_COOKIE = 'ct_token';
const CSRF_COOKIE = 'ct_csrf';
const CSRF_HEADER = 'x-csrf-token';

/** Issue a signed JWT for a user id + role. */
function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/** Verify a JWT, returning the payload or null. */
function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}

/** Base cookie options shared by auth + CSRF cookies. */
function cookieOptions() {
  const sameSite = process.env.COOKIE_SAME_SITE || (env.cookieSecure ? 'none' : 'lax');
  return {
    httpOnly: true,
    secure: env.cookieSecure, // true in production (HTTPS only)
    sameSite,
    path: '/',
  };
}

/** Set the auth + CSRF cookies on a response. */
function setAuthCookies(res, token) {
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
  // The CSRF cookie must be readable by the frontend (double-submit pattern).
  const csrfToken = crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE, csrfToken, { ...cookieOptions(), httpOnly: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.set(CSRF_HEADER, csrfToken);
  return csrfToken;
}

function clearAuthCookies(res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.clearCookie(CSRF_COOKIE, { ...cookieOptions(), httpOnly: false });
}

module.exports = { AUTH_COOKIE, CSRF_COOKIE, CSRF_HEADER, signToken, verifyToken, setAuthCookies, clearAuthCookies };
