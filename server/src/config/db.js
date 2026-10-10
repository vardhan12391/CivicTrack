const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB. Retries a few times so a just-started local mongod
 * doesn't crash the API on boot.
 */
async function connectDB(retries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
      console.log(`[db] connected to ${maskUri(env.mongoUri)}`);
      return mongoose.connection;
    } catch (err) {
      console.error(`[db] connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

/** Hide credentials before logging a connection string. */
function maskUri(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//<redacted>@');
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
