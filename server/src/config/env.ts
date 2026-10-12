import 'dotenv/config';
import { z } from 'zod';

const booleanish = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Optional pg pool override - set low (~2) on serverless platforms.
  DB_POOL_MAX: z.coerce.number().int().positive().optional(),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  APP_URL: z.string().url().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_CROSS_SITE: booleanish,
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),

  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  MAIL_PROVIDER: z.enum(['none', 'smtp']).default('none'),
  MAIL_FROM: z.string().min(3).default('Forge <noreply@example.com>'),
  SMTP_HOST: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanish,
  SMTP_USER: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  SMTP_PASS: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@forge.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123!'),
  SEED_DEMO_EMAIL: z.string().email().default('demo@forge.local'),
  SEED_DEMO_PASSWORD: z.string().min(8).default('ChangeMe123!'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Fail fast and loudly: a half-configured server is worse than no server.
  console.error(`\nInvalid environment configuration:\n${details}\n\nCopy server/.env.example to server/.env and fill it in.\n`);
  process.exit(1);
}

if (parsed.data.MAIL_PROVIDER === 'smtp' && !parsed.data.SMTP_HOST) {
  console.error('\nInvalid environment configuration:\n  - SMTP_HOST is required when MAIL_PROVIDER=smtp\n');
  process.exit(1);
}

if (parsed.data.SMTP_USER && !parsed.data.SMTP_PASS) {
  console.error('\nInvalid environment configuration:\n  - SMTP_PASS is required when SMTP_USER is set\n');
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
};

export type Env = typeof env;
