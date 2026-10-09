import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { currentUser } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { parseIsoDate } from '../../lib/dates.js';
import { serializeUser } from './users.serializer.js';
import { notificationPrefsSchema, onboardingSchema, updateProfileSchema } from './users.schemas.js';

const router = Router();

/** Strips `undefined` so a PATCH only touches the fields it was sent. */
function definedOnly<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
}

router.get('/me', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).id } });
  res.json({ user: serializeUser(user) });
});

router.patch('/me', validate({ body: updateProfileSchema }), async (req, res) => {
  const { dateOfBirth, ...rest } = req.body;
  const user = await prisma.user.update({
    where: { id: currentUser(req).id },
    data: {
      ...definedOnly(rest),
      ...(dateOfBirth === undefined ? {} : { dateOfBirth: dateOfBirth ? parseIsoDate(dateOfBirth) : null }),
    },
  });
  res.json({ user: serializeUser(user) });
});

/** Completing onboarding stamps `onboardedAt`; the client can also skip it. */
router.post('/me/onboarding', validate({ body: onboardingSchema }), async (req, res) => {
  const user = await prisma.user.update({
    where: { id: currentUser(req).id },
    data: { ...definedOnly(req.body), onboardedAt: new Date() },
  });
  res.json({ user: serializeUser(user) });
});

router.post('/me/onboarding/skip', async (req, res) => {
  const user = await prisma.user.update({
    where: { id: currentUser(req).id },
    data: { onboardedAt: new Date() },
  });
  res.json({ user: serializeUser(user) });
});

router.get('/me/notifications', async (req, res) => {
  const userId = currentUser(req).id;
  const prefs = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  res.json({ preferences: prefs });
});

router.patch('/me/notifications', validate({ body: notificationPrefsSchema }), async (req, res) => {
  const userId = currentUser(req).id;
  const data = definedOnly(req.body);
  const prefs = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  res.json({ preferences: prefs });
});

/**
 * Soft delete: the row is retained so historical sessions stay referentially
 * intact, but the account can no longer authenticate.
 */
router.delete('/me', async (req, res) => {
  const userId = currentUser(req).id;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), email: `deleted+${userId}@forge.invalid` },
    }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  res.status(204).end();
});

export default router;
