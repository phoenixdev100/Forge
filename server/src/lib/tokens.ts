import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '../generated/prisma/enums.js';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'forge',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'forge' });
  if (typeof decoded === 'string') throw new Error('Malformed access token');
  return decoded as AccessTokenPayload & jwt.JwtPayload;
}

/**
 * Refresh tokens are opaque random strings, not JWTs: they must be revocable.
 * Only the SHA-256 digest is persisted, so a database leak cannot be replayed.
 */
export function createRefreshToken() {
  const token = crypto.randomBytes(48).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createUrlSafeToken(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

/** Timing-safe comparison for digests of equal length. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const refreshTokenTtlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
