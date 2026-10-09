import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { ACCESS_COOKIE } from '../modules/auth/auth.cookies.js';
import { Role } from '../generated/prisma/enums.js';

function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;
  const cookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  return cookie || undefined;
}

/**
 * Every workout, plan and measurement is private. This runs before any
 * handler that touches user data - route protection on the client is only
 * cosmetic, authorisation is enforced here and in each module's queries.
 */
export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = readToken(req);
  if (!token) {
    next(unauthorized('You need to sign in to continue.'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
};

/** Attaches the user when a valid token is present, but never rejects. */
export const optionalAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = readToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    // Ignore: an expired token on a public route is not an error.
  }
  next();
};

export const requireAdmin: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (req.user.role !== Role.ADMIN) {
    next(forbidden('This area is restricted to administrators.'));
    return;
  }
  next();
};

/** Narrows `req.user` for handlers mounted behind `requireAuth`. */
export function currentUser(req: Request) {
  if (!req.user) throw unauthorized();
  return req.user;
}
