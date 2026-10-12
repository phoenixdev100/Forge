import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';

const disabled = env.isTest;

const base = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again shortly.' } },
};

/** Generous: logging sets during a workout is high-frequency by nature. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 600,
  keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? ''),
});

/** Strict: protects credential endpoints from brute force. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 20,
  skipSuccessfulRequests: true,
});

/** Very strict: password reset emails are an abuse vector. */
export const passwordResetLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 5,
});

/** Moderate: refresh is rotation-protected, but it hits the DB every call. */
export const refreshLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 60,
});
