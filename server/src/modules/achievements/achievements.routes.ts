import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { currentUser } from '../../middleware/auth.js';
import { SessionStatus } from '../../generated/prisma/enums.js';
import { num } from '../../lib/serialize.js';
import { computeStreak } from '../progress/stats.service.js';

const router = Router();

/**
 * Achievements are evaluated lazily on read: the metric name maps to a rolled-up
 * stat, progress is compared to the threshold, and newly crossed thresholds get
 * a UserAchievement row (idempotent). Pure data - the seed defines the set.
 */
router.get('/', async (req, res) => {
  const userId = currentUser(req).id;

  const [achievements, unlocked, totals, streak] = await Promise.all([
    prisma.achievement.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true, unlockedAt: true } }),
    prisma.workoutSession.aggregate({
      where: { userId, status: SessionStatus.COMPLETED },
      _count: true,
      _sum: { totalSets: true, totalVolumeKg: true, prCount: true },
    }),
    computeStreak(userId),
  ]);

  const uniqueExercises = await prisma.sessionExercise.findMany({
    where: { session: { userId, status: SessionStatus.COMPLETED } },
    distinct: ['exerciseId'],
    select: { exerciseId: true },
  });

  const stats: Record<string, number> = {
    workouts: totals._count,
    sets: totals._sum.totalSets ?? 0,
    volumeKg: Math.round(num(totals._sum.totalVolumeKg) ?? 0),
    prs: totals._sum.prCount ?? 0,
    streak: Math.max(streak.current, streak.longest),
    uniqueExercises: uniqueExercises.length,
  };

  const unlockedById = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));
  const newlyUnlocked: Array<{ userId: string; achievementId: string; progress: number; unlockedAt: Date }> = [];

  const items = achievements.map((a) => {
    const progress = Math.min(stats[a.metric] ?? 0, a.threshold);
    const earned = (stats[a.metric] ?? 0) >= a.threshold;
    const already = unlockedById.get(a.id);
    if (earned && !already) {
      newlyUnlocked.push({ userId, achievementId: a.id, progress: stats[a.metric] ?? a.threshold, unlockedAt: new Date() });
    }
    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      iconKey: a.iconKey,
      category: a.category,
      metric: a.metric,
      threshold: a.threshold,
      progress,
      unlockedAt: already?.toISOString() ?? (earned ? new Date().toISOString() : null),
    };
  });

  if (newlyUnlocked.length) {
    await prisma.userAchievement.createMany({ data: newlyUnlocked, skipDuplicates: true });
  }

  res.json({ achievements: items, unlockedCount: items.filter((i) => i.unlockedAt).length });
});

export default router;
