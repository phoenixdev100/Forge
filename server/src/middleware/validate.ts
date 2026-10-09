import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';
import { badRequest } from '../lib/errors.js';

type Schemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

/** Flatten Zod issues into `{ "day.exercises.0.targetSets": "message" }`. */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Validates and REPLACES `req.body` / `req.query` / `req.params` with the
 * parsed result, so handlers always receive coerced, trusted values.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      // A POST with no body should parse as {} - all-optional schemas must not
      // fail just because the client omitted a body entirely.
      const result = schema.safeParse(key === 'body' ? (req.body ?? {}) : req[key]);
      if (!result.success) {
        next(badRequest('Please check the highlighted fields.', fieldErrors(result.error)));
        return;
      }
      // req.query is a getter-only property on Express 5.
      Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true });
    }
    next();
  };
}

/** Shared primitives used across modules. */
export const cuidParam = (name: string) => z.object({ [name]: z.string().min(1) });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

/** `YYYY-MM-DD`, kept as a plain string so it stays timezone-free. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Not a real date');
