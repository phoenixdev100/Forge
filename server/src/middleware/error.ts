import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { Prisma } from '../db/prisma.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
  });
};

type Normalised = { status: number; code: string; message: string; details?: unknown; logLevel: 'warn' | 'error' };

function normalise(err: unknown): Normalised {
  if (err instanceof AppError) {
    return {
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details,
      logLevel: err.status >= 500 ? 'error' : 'warn',
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Please check the highlighted fields.',
      details: Object.fromEntries(err.issues.map((i) => [i.path.join('.') || '_', i.message])),
      logLevel: 'warn',
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = err.meta?.['target'];
        const fields = Array.isArray(target) ? target.join(', ') : String(target ?? 'value');
        return {
          status: 409,
          code: 'DUPLICATE',
          message: `That ${fields} is already in use.`,
          logLevel: 'warn',
        };
      }
      case 'P2025':
        return { status: 404, code: 'NOT_FOUND', message: 'We could not find that.', logLevel: 'warn' };
      case 'P2003':
        return {
          status: 409,
          code: 'IN_USE',
          message: 'This item is still referenced by other records.',
          logLevel: 'warn',
        };
      default:
        return { status: 500, code: 'DATABASE_ERROR', message: 'Something went wrong on our end.', logLevel: 'error' };
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, code: 'BAD_REQUEST', message: 'The request was invalid.', logLevel: 'error' };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'We could not reach the database. Please try again.',
      logLevel: 'error',
    };
  }

  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name: string }).name;
    if (name === 'TokenExpiredError') {
      return { status: 401, code: 'TOKEN_EXPIRED', message: 'Your session expired.', logLevel: 'warn' };
    }
    if (name === 'JsonWebTokenError') {
      return { status: 401, code: 'UNAUTHORIZED', message: 'Your session is no longer valid.', logLevel: 'warn' };
    }
  }

  return { status: 500, code: 'INTERNAL', message: 'Something went wrong on our end.', logLevel: 'error' };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const { status, code, message, details, logLevel } = normalise(err);

  logger[logLevel](
    { err, status, code, method: req.method, url: req.originalUrl, userId: req.user?.id },
    message,
  );

  if (res.headersSent) return;

  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(env.isProduction || status < 500 ? {} : { stack: (err as Error)?.stack }),
    },
  });
};
