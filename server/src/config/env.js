require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config(); // server/.env takes precedence if present

const ENV = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civictrack',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  seedOnStart: process.env.SEED_ON_START === 'true',
  nodeEnv: process.env.NODE_ENV || 'development',
};

if (ENV.nodeEnv === 'production' && (!process.env.JWT_SECRET || ENV.jwtSecret.length < 16)) {
  console.error('FATAL: JWT_SECRET must be set to a long random value in production.');
  process.exit(1);
}

module.exports = ENV;
