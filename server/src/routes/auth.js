const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const ctrl = require('../controllers/authController');

// Brute-force protection: 10 attempts / 15 min per IP on register + login.
// Effectively disabled under NODE_ENV=test so the test suite can log in
// as many accounts as it needs.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 100000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please wait 15 minutes and try again.', code: 'RATE_LIMITED' } },
});

router.post('/register', authLimiter, ctrl.register);
router.post('/login', authLimiter, ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', ctrl.me);

module.exports = router;
