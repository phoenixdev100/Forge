import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma, prisma } from './db/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Forge API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Slow-connection hardening. keepAliveTimeout must outlive the load balancer's
// idle timeout (typically 60s) to avoid stale-socket races; headersTimeout must
// exceed it. requestTimeout bounds the whole request incl. body - generous
// enough for the largest allowed media upload on a weak connection.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.requestTimeout = 120_000;

// Surface a bad DATABASE_URL at boot rather than on the user's first request.
void prisma
  .$queryRaw`SELECT 1`
  .then(() => logger.info('Database connection established'))
  .catch((err: unknown) => logger.error({ err }, 'Database unreachable - check DATABASE_URL'));

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
  // Don't let an in-flight request hang the process forever.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  process.exit(1);
});
