/**
 * Server entry point: connect to MongoDB, then start Express.
 * `npm start` (production) / `npm run dev` (nodemon).
 */
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');

let server = null;

async function main() {
  await connectDB();

  if (env.seedOnStart) {
    // SEED_ON_START=true → wipe & reload demonstration data on boot.
    console.log('[seed] SEED_ON_START enabled — reseeding database.');
    const { seed } = require('./scripts/seed');
    await seed({ wipe: true });
  }

  server = app.listen(env.port, () => {
    console.log(`[api] CivicTrack API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

/** Graceful shutdown so tests and deploys don't drop connections. */
async function shutdown(signal) {
  console.log(`[api] received ${signal}, shutting down…`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('[api] failed to start:', err.message);
  process.exit(1);
});
