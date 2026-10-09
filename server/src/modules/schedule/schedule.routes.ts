import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { currentUser } from '../../middleware/auth.js';
import { isoDate, validate } from '../../middleware/validate.js';
import { addDays, startOfMonth, toIsoDate, todayFor } from '../../lib/dates.js';
import { scheduleOverrideSchema, scheduleRangeQuery } from '../plans/plans.schemas.js';
import * as service from './schedule.service.js';

const router = Router();

router.get('/', validate({ query: scheduleRangeQuery }), async (req, res) => {
  const { from, to } = req.query as unknown as z.infer<typeof scheduleRangeQuery>;
  res.json(await service.resolveSchedule(currentUser(req).id, from, to));
});

/** Convenience for the calendar: a whole month plus the padding weeks around it. */
router.get(
  '/month',
  validate({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }) }),
  async (req, res) => {
    const userId = currentUser(req).id;
    const { timezone } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const { month } = req.query as unknown as { month?: string };
    const anchor = month ? new Date(`${month}-01T00:00:00.000Z`) : todayFor(timezone);
    const first = startOfMonth(anchor);
    const last = addDays(startOfMonth(addDays(first, 32)), -1);
    res.json(await service.resolveSchedule(userId, toIsoDate(addDays(first, -7)), toIsoDate(addDays(last, 7))));
  },
);

router.get('/:date', validate({ params: z.object({ date: isoDate }) }), async (req, res) => {
  res.json({ day: await service.resolveDate(currentUser(req).id, req.params.date as string) });
});

/**
 * Overrides one calendar date without editing the recurring plan: swap the
 * workout, mark it as rest, or clear it.
 */
router.put(
  '/:date/override',
  validate({ params: z.object({ date: isoDate }), body: scheduleOverrideSchema }),
  async (req, res) => {
    res.json({ day: await service.upsertOverride(currentUser(req).id, req.params.date as string, req.body) });
  },
);

router.delete('/:date/override', validate({ params: z.object({ date: isoDate }) }), async (req, res) => {
  res.json({ day: await service.clearOverride(currentUser(req).id, req.params.date as string) });
});

/**
 * "Missed a day" recovery: slides that date's workout to the next day and
 * pushes the rest of the week along by one, via per-date overrides.
 */
router.post(
  '/shift',
  validate({ body: z.object({ from: isoDate, ongoing: z.boolean().default(false) }) }),
  async (req, res) => {
    const { from, ongoing } = req.body as unknown as { from: string; ongoing: boolean };
    res.json({ day: await service.shiftForward(currentUser(req).id, from, ongoing) });
  },
);

export default router;
