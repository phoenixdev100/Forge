import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// A shadow database is only needed by `prisma migrate dev`. `db push` never
// touches one, and Neon poolers can't CREATE DATABASE anyway — so only wire it
// up when a genuinely separate database is configured.
const shadow = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    ...(shadow && shadow !== process.env.DATABASE_URL ? { shadowDatabaseUrl: shadow } : {}),
  },
});
