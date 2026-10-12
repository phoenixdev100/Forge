import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // `pg` defaults to no connect timeout, which turns an unreachable database
  // into a hung request instead of a fast, clear error.
  connectionTimeoutMillis: 10_000,
  // Serverless instances should hold few connections - the provider's pooler
  // does the real multiplexing. Tune via DB_POOL_MAX on constrained hosts.
  max: env.DB_POOL_MAX ?? (env.isProduction ? 10 : 5),
});

const createClient = () =>
  new PrismaClient({
    adapter,
    log: env.isDevelopment ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }] : ['error'],
  });

// tsx's watch mode re-executes modules on every change; reusing the client off
// globalThis avoids exhausting the database's connection limit in development.
const globalForPrisma = globalThis as typeof globalThis & { __forgePrisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.__forgePrisma ?? createClient();

if (!env.isProduction) {
  globalForPrisma.__forgePrisma = prisma;
  prisma.$on('warn', (e) => logger.warn({ prisma: e }, 'prisma warning'));
  prisma.$on('error', (e) => logger.error({ prisma: e }, 'prisma error'));
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export type Db = typeof prisma;
export { Prisma } from '../generated/prisma/client.js';
