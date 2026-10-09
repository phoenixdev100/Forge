import { prisma } from '../../db/prisma.js';
import {
  addDays,
  cyclePositionFor,
  startOfWeek,
  toIsoDate,
  todayFor,
} from '../../lib/dates.js';
import { num } from '../../lib/serialize.js';
import { PlanDayType, SessionStatus } from '../../generated/prisma/enums.js';

type UserContext = { id: string; timezone: string; weekStartsOn: number; unit: string };

export async function getUserContext(userId: string): Promise<UserContext> {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, timezone: true, weekStartsOn: true, unit: true },
  });
}

/**
 * Consecutive-day streak.
 *
 * A scheduled rest day does NOT break the streak - punishing someone for
 * following their own plan is the fastest way to make a streak feel hostile.
 * A day with no workout and no scheduled rest does break it.
 */
export async function computeStreak(userId: string) {
  const user = await getUserContext(userId);
  const today = todayFor(user.timezone);
  const horizon = addDays(today, -400);

  const [completed, plan, overrides] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: SessionStatus.COMPLETED, date: { gte: horizon, lte: today } },
      select: { date: true },
    }),
    prisma.workoutPlan.findFirst({
      where: { userId, isActive: true, archivedAt: null },
      select: {
        cycleLength: true,
        startsOn: true,
        days: { select: { position: true, dayType: true } },
      },
    }),
    prisma.scheduleOverride.findMany({
      where: { userId, date: { gte: horizon, lte: today } },
      select: { date: true, isRest: true, planDayId: true },
    }),
  ]);

  const trained = new Set(completed.map((s) => toIsoDate(s.date)));
  const overrideByDate = new Map(overrides.map((o) => [toIsoDate(o.date), o]));
  const dayTypeByPosition = new Map((plan?.days ?? []).map((d) => [d.position, d.dayType]));

  const isRestDay = (date: Date) => {
    const override = overrideByDate.get(toIsoDate(date));
    if (override) return override.isRest || !override.planDayId;
    if (!plan) return false;
    const position = cyclePositionFor(date, plan, user.weekStartsOn);
    const day = dayTypeByPosition.get(position);
    // An unscheduled position is implicitly a rest day.
    return day === undefined || day === PlanDayType.REST;
  };

  let current = 0;
  let cursor = today;
  // Today not being trained yet should not zero out a live streak.
  if (!trained.has(toIsoDate(today)) && !isRestDay(today)) cursor = addDays(today, -1);

  for (let i = 0; i < 400; i += 1) {
    const iso = toIsoDate(cursor);
    if (trained.has(iso)) current += 1;
    else if (!isRestDay(cursor)) break;
    cursor = addDays(cursor, -1);
  }

  // Longest streak over the same window, using the same rest-day rule.
  let longest = 0;
  let run = 0;
  for (let date = horizon; date <= today; date = addDays(date, 1)) {
    const iso = toIsoDate(date);
    if (trained.has(iso)) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (!isRestDay(date)) {
      run = 0;
    }
  }

  return { current, longest, lastTrainedOn: completed.length ? toIsoDate(new Date(Math.max(...completed.map((c) => c.date.getTime())))) : null };
}

/** Headline numbers for the dashboard and progress pages. */
export async function getTotals(userId: string) {
  const user = await getUserContext(userId);
  const today = todayFor(user.timezone);
  const weekStart = startOfWeek(today, user.weekStartsOn);
  const monthStart = addDays(today, -29);

  const completed = { userId, status: SessionStatus.COMPLETED } as const;

  const [all, thisWeek, last30, distinctExercises] = await Promise.all([
    prisma.workoutSession.aggregate({
      where: completed,
      _count: true,
      _sum: { totalVolumeKg: true, totalSets: true, totalReps: true, durationSeconds: true, prCount: true },
    }),
    prisma.workoutSession.aggregate({
      where: { ...completed, date: { gte: weekStart, lte: today } },
      _count: true,
      _sum: { totalVolumeKg: true, totalSets: true },
    }),
    prisma.workoutSession.aggregate({
      where: { ...completed, date: { gte: monthStart, lte: today } },
      _count: true,
      _sum: { totalVolumeKg: true, totalSets: true },
    }),
    prisma.sessionExercise.findMany({
      where: { session: completed },
      distinct: ['exerciseId'],
      select: { exerciseId: true },
    }),
  ]);

  return {
    totalWorkouts: all._count,
    totalSets: all._sum.totalSets ?? 0,
    totalReps: all._sum.totalReps ?? 0,
    totalVolumeKg: num(all._sum.totalVolumeKg) ?? 0,
    totalDurationSeconds: all._sum.durationSeconds ?? 0,
    totalPrs: all._sum.prCount ?? 0,
    uniqueExercises: distinctExercises.length,
    thisWeek: {
      workouts: thisWeek._count,
      volumeKg: num(thisWeek._sum.totalVolumeKg) ?? 0,
      sets: thisWeek._sum.totalSets ?? 0,
      weekStart: toIsoDate(weekStart),
    },
    last30Days: {
      workouts: last30._count,
      volumeKg: num(last30._sum.totalVolumeKg) ?? 0,
      sets: last30._sum.totalSets ?? 0,
    },
  };
}

/** Per-day activity for the dashboard heat strip. */
export async function getWeeklyActivity(userId: string, weeks = 1) {
  const user = await getUserContext(userId);
  const today = todayFor(user.timezone);
  const start = addDays(startOfWeek(today, user.weekStartsOn), -(weeks - 1) * 7);

  const sessions = await prisma.workoutSession.findMany({
    where: { userId, status: SessionStatus.COMPLETED, date: { gte: start, lte: today } },
    select: { date: true, title: true, totalVolumeKg: true, totalSets: true },
  });

  const byDate = new Map<string, { workouts: number; volumeKg: number; sets: number; titles: string[] }>();
  for (const session of sessions) {
    const key = toIsoDate(session.date);
    const entry = byDate.get(key) ?? { workouts: 0, volumeKg: 0, sets: 0, titles: [] };
    entry.workouts += 1;
    entry.volumeKg += num(session.totalVolumeKg) ?? 0;
    entry.sets += session.totalSets;
    entry.titles.push(session.title);
    byDate.set(key, entry);
  }

  const days: Array<{ date: string; workouts: number; volumeKg: number; sets: number; titles: string[] }> = [];
  for (let date = start; date <= today; date = addDays(date, 1)) {
    const key = toIsoDate(date);
    days.push({ date: key, ...(byDate.get(key) ?? { workouts: 0, volumeKg: 0, sets: 0, titles: [] }) });
  }

  return days;
}

/** Workout count + volume per calendar week, for the frequency chart. */
export async function getVolumeTrend(userId: string, weeks = 12) {
  const user = await getUserContext(userId);
  const today = todayFor(user.timezone);
  const start = addDays(startOfWeek(today, user.weekStartsOn), -(weeks - 1) * 7);

  const sessions = await prisma.workoutSession.findMany({
    where: { userId, status: SessionStatus.COMPLETED, date: { gte: start, lte: today } },
    select: { date: true, totalVolumeKg: true, totalSets: true, durationSeconds: true },
  });

  const buckets = new Map<string, { workouts: number; volumeKg: number; sets: number; minutes: number }>();
  for (let i = 0; i < weeks; i += 1) {
    buckets.set(toIsoDate(addDays(start, i * 7)), { workouts: 0, volumeKg: 0, sets: 0, minutes: 0 });
  }

  for (const session of sessions) {
    const key = toIsoDate(startOfWeek(session.date, user.weekStartsOn));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.workouts += 1;
    bucket.volumeKg += num(session.totalVolumeKg) ?? 0;
    bucket.sets += session.totalSets;
    bucket.minutes += Math.round((session.durationSeconds ?? 0) / 60);
  }

  return [...buckets.entries()].map(([weekStart, v]) => ({ weekStart, ...v }));
}

/** Which muscle groups actually got trained - reveals neglected areas. */
export async function getMuscleGroupBalance(userId: string, days = 30) {
  const user = await getUserContext(userId);
  const today = todayFor(user.timezone);
  const start = addDays(today, -(days - 1));

  const rows = await prisma.sessionExercise.findMany({
    where: {
      session: { userId, status: SessionStatus.COMPLETED, date: { gte: start, lte: today } },
    },
    select: {
      exercise: { select: { primaryMuscle: { select: { id: true, slug: true, name: true, colorHex: true } } } },
      sets: { where: { isCompleted: true }, select: { volumeKg: true, setType: true } },
    },
  });

  const byMuscle = new Map<
    string,
    { id: string; slug: string; name: string; colorHex: string; sets: number; volumeKg: number; exercises: number }
  >();

  for (const row of rows) {
    const muscle = row.exercise.primaryMuscle;
    const entry =
      byMuscle.get(muscle.id) ?? { ...muscle, sets: 0, volumeKg: 0, exercises: 0 };
    entry.exercises += 1;
    for (const set of row.sets) {
      if (set.setType === 'WARMUP') continue;
      entry.sets += 1;
      entry.volumeKg += num(set.volumeKg) ?? 0;
    }
    byMuscle.set(muscle.id, entry);
  }

  return [...byMuscle.values()].sort((a, b) => b.sets - a.sets);
}

/**
 * Per-exercise progression: one point per session, with the best set of that
 * session on each metric so the chart can switch between them client-side.
 */
export async function getExerciseProgress(userId: string, exerciseId: string, limit = 60) {
  const exercise = await prisma.exercise.findFirst({
    where: {
      id: exerciseId,
      OR: [{ isCustom: false }, { isCustom: true, createdById: userId }],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      trackingType: true,
      thumbnailUrl: true,
      primaryMuscle: { select: { id: true, slug: true, name: true, colorHex: true } },
    },
  });
  if (!exercise) return null;

  const rows = await prisma.sessionExercise.findMany({
    where: {
      exerciseId,
      session: { userId, status: SessionStatus.COMPLETED },
      sets: { some: { isCompleted: true } },
    },
    orderBy: { session: { date: 'desc' } },
    take: limit,
    select: {
      sessionId: true,
      session: { select: { date: true } },
      sets: {
        where: { isCompleted: true },
        select: { setType: true, weightKg: true, reps: true, volumeKg: true, estimatedOneRmKg: true, timeSeconds: true },
      },
    },
  });

  const points = rows
    .map((row) => {
      const working = row.sets.filter((s) => s.setType !== 'WARMUP');
      if (!working.length) return null;

      const weights = working.map((s) => num(s.weightKg) ?? 0);
      const reps = working.map((s) => s.reps ?? 0);
      const oneRms = working.map((s) => num(s.estimatedOneRmKg) ?? 0);

      return {
        sessionId: row.sessionId,
        date: toIsoDate(row.session.date),
        sets: working.length,
        maxWeightKg: Math.max(...weights),
        maxReps: Math.max(...reps),
        totalReps: reps.reduce((a, b) => a + b, 0),
        volumeKg: working.reduce((sum, s) => sum + (num(s.volumeKg) ?? 0), 0),
        estimatedOneRmKg: Math.max(...oneRms),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .reverse();

  const best = points.reduce(
    (acc, p) => ({
      maxWeightKg: Math.max(acc.maxWeightKg, p.maxWeightKg),
      maxReps: Math.max(acc.maxReps, p.maxReps),
      maxVolumeKg: Math.max(acc.maxVolumeKg, p.volumeKg),
      maxOneRmKg: Math.max(acc.maxOneRmKg, p.estimatedOneRmKg),
    }),
    { maxWeightKg: 0, maxReps: 0, maxVolumeKg: 0, maxOneRmKg: 0 },
  );

  return {
    exercise,
    points,
    totals: {
      sessions: points.length,
      sets: points.reduce((sum, p) => sum + p.sets, 0),
      volumeKg: points.reduce((sum, p) => sum + p.volumeKg, 0),
      ...best,
    },
  };
}

/** Exercises the user actually trains, for progress-page pickers. */
export async function getTrainedExercises(userId: string) {
  const rows = await prisma.sessionExercise.findMany({
    where: { session: { userId, status: SessionStatus.COMPLETED } },
    distinct: ['exerciseId'],
    orderBy: { createdAt: 'desc' },
    select: {
      exerciseId: true,
      nameSnapshot: true,
      exercise: {
        select: {
          slug: true,
          thumbnailUrl: true,
          primaryMuscle: { select: { id: true, slug: true, name: true, colorHex: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.exerciseId,
    name: r.nameSnapshot,
    slug: r.exercise.slug,
    thumbnailUrl: r.exercise.thumbnailUrl,
    primaryMuscle: r.exercise.primaryMuscle,
  }));
}
