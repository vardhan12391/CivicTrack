/**
 * Express application assembly.
 * Order matters: security headers → CORS → parsing → cookies →
 * authentication (attaches req.user) → CSRF check → routes → errors.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const env = require('./config/env');
const { authenticate, requireCsrf } = require('./middleware/auth');
const { ApiError, notFoundHandler, errorHandler } = require('./utils/errors');

const app = express();

// Behind Render's proxy — needed for correct client IPs (rate limiting).
app.set('trust proxy', 1);

// Security headers. Static images are served from /uploads, so allow
// same-origin image loading; the API itself returns JSON only.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // SPA + Leaflet tiles from openstreetmap.org
  })
);

// CORS: only the configured frontend origin(s), with cookies allowed.
const allowedOrigins = env.clientOrigin.split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      // Same-origin/server-to-server requests have no Origin header.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(ApiError.forbidden('Origin not allowed by CORS.'));
    },
    credentials: true,
    exposedHeaders: ['x-csrf-token'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv !== 'test') app.use(morgan('dev'));
app.use(cookieParser());

// Locally uploaded report images (Cloudinary is used instead when configured).
const uploadDir = path.resolve(process.cwd(), env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir, { maxAge: env.nodeEnv === 'production' ? '7d' : 0 }));

// Attach req.user from the JWT cookie, then enforce CSRF double-submit
// on every mutating request (GET/HEAD/OPTIONS are exempt inside).
app.use(authenticate);
app.use(requireCsrf);

/* ---------- Health check (required for deployment) ---------- */
app.get('/api/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    db: states[mongoose.connection.readyState] || 'unknown',
    environment: env.nodeEnv,
    time: new Date().toISOString(),
  });
});

/* ---------- Routes ---------- */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/milestones', require('./routes/milestones'));
app.use('/api/conflicts', require('./routes/conflicts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/users', require('./routes/users'));
app.use('/api/audit', require('./routes/audit'));

/* ---------- Errors ---------- */
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
