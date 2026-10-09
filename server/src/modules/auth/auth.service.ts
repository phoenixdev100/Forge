import crypto from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import { fakeVerify, hashPassword, verifyPassword } from '../../lib/password.js';
import {
  createRefreshToken,
  createUrlSafeToken,
  hashToken,
  refreshTokenTtlMs,
  signAccessToken,
} from '../../lib/tokens.js';
import { serializeUser } from '../users/users.serializer.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import type { UserModel } from '../../generated/prisma/models.js';

type Context = { userAgent?: string | undefined; ip?: string | undefined };

async function issueTokens(user: UserModel, ctx: Context, family: string = crypto.randomUUID()) {
  const { token, tokenHash } = createRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      family,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs),
      userAgent: ctx.userAgent?.slice(0, 255) ?? null,
      ip: ctx.ip ?? null,
    },
  });

  return {
    accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    refreshToken: token,
  };
}

export async function register(input: RegisterInput, ctx: Context) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw conflict('An account with that email already exists.', 'EMAIL_TAKEN', { email: 'Email already in use.' });
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      timezone: input.timezone ?? 'UTC',
      notificationPrefs: { create: {} },
    },
  });

  const tokens = await issueTokens(user, ctx);
  return { user: serializeUser(user), tokens };
}

export async function login(input: LoginInput, ctx: Context) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Same error and comparable timing whether the email exists or not.
  if (!user || user.deletedAt) {
    await fakeVerify();
    throw unauthorized('That email or password is incorrect.', 'INVALID_CREDENTIALS');
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw unauthorized('That email or password is incorrect.', 'INVALID_CREDENTIALS');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const tokens = await issueTokens(user, ctx);
  return { user: serializeUser(user), tokens };
}

/**
 * Refresh with rotation + reuse detection. Presenting an already-rotated token
 * means it leaked, so the whole family is revoked and the user must sign in.
 */
export async function refresh(presentedToken: string, ctx: Context) {
  const tokenHash = hashToken(presentedToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) throw unauthorized('Your session is no longer valid.', 'INVALID_REFRESH_TOKEN');

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn({ userId: stored.userId, family: stored.family }, 'refresh token reuse detected');
    throw unauthorized('Your session is no longer valid.', 'INVALID_REFRESH_TOKEN');
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Your session expired. Please sign in again.', 'REFRESH_TOKEN_EXPIRED');
  }

  if (stored.user.deletedAt) throw unauthorized('This account is no longer active.');

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const tokens = await issueTokens(stored.user, ctx, stored.family);
  return { user: serializeUser(stored.user), tokens };
}

export async function logout(presentedToken: string | undefined) {
  if (!presentedToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(presentedToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * Always resolves successfully - revealing whether an email is registered is
 * an account-enumeration leak.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt) return;

  // One live reset link at a time.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, tokenHash } = createUrlSafeToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60_000),
    },
  });

  const link = `${env.APP_URL}/reset-password?token=${token}`;
  // No mail provider is wired up yet; in development the link is logged so the
  // flow is fully testable end to end.
  if (env.isProduction) {
    logger.info({ userId: user.id }, 'password reset requested');
  } else {
    logger.info({ link }, 'password reset link (development only)');
  }
  return link;
}

export async function resetPassword(token: string, newPassword: string) {
  const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
    throw unauthorized('This reset link is invalid or has expired.', 'INVALID_RESET_TOKEN');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
    // A password reset invalidates every existing session.
    prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

/**
 * Changing a password signs every other device out, then re-issues tokens for
 * the device that made the change so the user is not kicked out of the app.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ctx: Context,
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw unauthorized('Your current password is incorrect.', 'INVALID_CREDENTIALS');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  return issueTokens(user, ctx);
}
