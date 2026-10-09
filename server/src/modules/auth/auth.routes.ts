import { Router, type Request } from 'express';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { unauthorized } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { authLimiter, passwordResetLimiter } from '../../middleware/rateLimit.js';
import { serializeUser } from '../users/users.serializer.js';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from './auth.cookies.js';
import * as service from './auth.service.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas.js';

const router = Router();

const context = (req: Request) => ({ userAgent: req.get('user-agent') ?? undefined, ip: req.ip });
const readRefreshCookie = (req: Request) => (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];

router.post('/register', authLimiter, validate({ body: registerSchema }), async (req, res) => {
  const { user, tokens } = await service.register(req.body, context(req));
  setAuthCookies(res, tokens);
  res.status(201).json({ user, accessToken: tokens.accessToken });
});

router.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
  const { user, tokens } = await service.login(req.body, context(req));
  setAuthCookies(res, tokens);
  res.json({ user, accessToken: tokens.accessToken });
});

/** Called by the client's 401 interceptor to transparently extend a session. */
router.post('/refresh', async (req, res) => {
  const token = readRefreshCookie(req);
  if (!token) throw unauthorized('Your session is no longer valid.', 'NO_REFRESH_TOKEN');

  try {
    const { user, tokens } = await service.refresh(token, context(req));
    setAuthCookies(res, tokens);
    res.json({ user, accessToken: tokens.accessToken });
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
});

router.post('/logout', async (req, res) => {
  await service.logout(readRefreshCookie(req));
  clearAuthCookies(res);
  res.status(204).end();
});

router.post('/logout-all', requireAuth, async (req, res) => {
  await service.logoutAll(currentUser(req).id);
  clearAuthCookies(res);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: currentUser(req).id } });
  if (!user || user.deletedAt) throw unauthorized('This account is no longer active.');
  res.json({ user: serializeUser(user) });
});

router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  async (req, res) => {
    const link = await service.requestPasswordReset(req.body.email);
    res.json({
      message: 'If an account exists for that email, a reset link is on its way.',
      // Surfaced in development only so the flow is testable without email.
      ...(env.isProduction ? {} : { devResetLink: link ?? null }),
    });
  },
);

router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), async (req, res) => {
  await service.resetPassword(req.body.token, req.body.password);
  clearAuthCookies(res);
  res.json({ message: 'Your password has been reset. You can sign in now.' });
});

router.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  async (req, res) => {
    const tokens = await service.changePassword(
      currentUser(req).id,
      req.body.currentPassword,
      req.body.newPassword,
      context(req),
    );
    setAuthCookies(res, tokens);
    res.json({ message: 'Password updated. Other devices have been signed out.' });
  },
);

export default router;
