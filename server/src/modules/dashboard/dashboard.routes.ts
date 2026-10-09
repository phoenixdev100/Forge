import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { currentUser } from '../../middleware/auth.js';
import { addDays, toIsoDate, todayFor } from '../../lib/dates.js';
import { SessionStatus } from '../../generated/prisma/enums.js';
import { resolveSchedule } from '../schedule/schedule.service.js';
import { recentPersonalRecords } from '../progress/records.service.js';
import { computeStreak, getTotals, getWeeklyActivity } from '../progress/stats.service.js';

const router = Router();

/**
 * One request powers the whole dashboard. The most important thing - today's
 * workout - comes first, and everything else is supporting context.
 */
router.get('/', async (req, res) => {
  const userId = currentUser(req).id;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true, unit: true, onboardedAt: true },
  });

  const today = todayFor(user.timezone);
  const todayIso = toIsoDate(today);

  const [schedule, streak, totals, activity, prs, activeSession, planCount] = await Promise.all([
    // Today plus the next week, so "upcoming" needs no second request.
    resolveSchedule(userId, todayIso, toIsoDate(addDays(today, 7))),
    computeStreak(userId),
    getTotals(userId),
    getWeeklyActivity(userId, 1),
    recentPersonalRecords(userId, 5),
    prisma.workoutSession.findFirst({
      where: { userId, status: SessionStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
      select: { id: true, title: true, date: true, startedAt: true },
    }),
    prisma.workoutPlan.count({ where: { userId, archivedAt: null } }),
  ]);

  const [todayEntry, ...rest] = schedule.entries;
  const upcoming = rest.filter((e) => e.scheduled && e.state !== 'rest').slice(0, 3);

  res.json({
    today: todayEntry ?? null,
    upcoming,
    activeSession: activeSession
      ? {
          id: activeSession.id,
          title: activeSession.title,
          date: toIsoDate(activeSession.date),
          startedAt: activeSession.startedAt.toISOString(),
        }
      : null,
    streak,
    totals,
    weeklyActivity: activity,
    recentPersonalRecords: prs,
    plan: schedule.plan,
    // Drives the empty states: no plan yet vs. plan but never trained.
    state: {
      hasPlan: Boolean(schedule.plan),
      planCount,
      hasTrained: totals.totalWorkouts > 0,
      needsOnboarding: user.onboardedAt === null,
    },
    unit: user.unit,
  });
});

export default router;
