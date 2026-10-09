import { prisma } from '../../db/prisma.js';
import { num } from '../../lib/serialize.js';
import { countsTowardVolume } from '../../lib/strength.js';
import { PrType, SessionStatus } from '../../generated/prisma/enums.js';

export type DetectedRecord = {
  id: string;
  type: PrType;
  exerciseId: string;
  exerciseName: string;
  value: number;
  previousValue: number | null;
  weightKg: number | null;
  reps: number | null;
  achievedAt: string;
};

type Candidate = {
  type: PrType;
  value: number;
  weightKg: number | null;
  reps: number | null;
  timeSeconds: number | null;
  sessionSetId: string | null;
};

/**
 * A record only counts if it beats the previous best by a real margin.
 * Floating point noise should never fire a "New PR!" celebration.
 */
const EPSILON = 0.001;

/**
 * Finds every personal record set during a session.
 *
 * Records are append-only: each broken record inserts a new row carrying its
 * `previousValue`, which gives both a current best (the latest row per
 * exercise+type) and a full progression history for the PR page.
 */
export async function detectPersonalRecords(
  userId: string,
  sessionId: string,
  achievedAt: Date,
): Promise<DetectedRecord[]> {
  const exercises = await prisma.sessionExercise.findMany({
    where: { sessionId, sets: { some: { isCompleted: true } } },
    select: {
      exerciseId: true,
      nameSnapshot: true,
      sets: {
        where: { isCompleted: true },
        select: {
          id: true,
          setType: true,
          weightKg: true,
          reps: true,
          timeSeconds: true,
          distanceM: true,
          volumeKg: true,
          estimatedOneRmKg: true,
        },
      },
    },
  });

  if (!exercises.length) return [];

  // Current bests for every exercise trained today, in one round trip.
  const exerciseIds = [...new Set(exercises.map((e) => e.exerciseId))];
  const existing = await prisma.personalRecord.findMany({
    where: { userId, exerciseId: { in: exerciseIds } },
    orderBy: { achievedAt: 'desc' },
    select: { exerciseId: true, type: true, value: true },
  });

  const bestByKey = new Map<string, number>();
  for (const record of existing) {
    const key = `${record.exerciseId}:${record.type}`;
    const value = num(record.value) ?? 0;
    if (!bestByKey.has(key) || value > (bestByKey.get(key) as number)) bestByKey.set(key, value);
  }

  const detected: DetectedRecord[] = [];

  for (const exercise of exercises) {
    const working = exercise.sets.filter((s) => countsTowardVolume(s.setType));
    if (!working.length) continue;

    const candidates: Candidate[] = [];

    const pickMax = (
      type: PrType,
      valueOf: (set: (typeof working)[number]) => number | null,
    ) => {
      let best: { set: (typeof working)[number]; value: number } | null = null;
      for (const set of working) {
        const value = valueOf(set);
        if (value == null || value <= 0) continue;
        if (!best || value > best.value) best = { set, value };
      }
      if (!best) return;
      candidates.push({
        type,
        value: best.value,
        weightKg: num(best.set.weightKg),
        reps: best.set.reps,
        timeSeconds: best.set.timeSeconds,
        sessionSetId: best.set.id,
      });
    };

    // Only values the user physically entered count as records. Volume and
    // estimated-1RM are derived metrics - they live on the sets and charts,
    // not in the records list.
    pickMax(PrType.MAX_WEIGHT, (s) => num(s.weightKg));
    pickMax(PrType.MAX_REPS, (s) => s.reps);
    pickMax(PrType.BEST_TIME, (s) => s.timeSeconds);
    pickMax(PrType.BEST_DISTANCE, (s) => num(s.distanceM));

    for (const candidate of candidates) {
      const key = `${exercise.exerciseId}:${candidate.type}`;
      const previous = bestByKey.get(key) ?? null;

      // The very first time an exercise is performed is a baseline, not a PR
      // worth celebrating - otherwise every new exercise fires six records.
      const isFirstEver = previous === null;
      if (!isFirstEver && candidate.value <= previous + EPSILON) continue;

      const record = await prisma.personalRecord.create({
        data: {
          userId,
          exerciseId: exercise.exerciseId,
          type: candidate.type,
          value: candidate.value,
          previousValue: previous,
          weightKg: candidate.weightKg,
          reps: candidate.reps,
          timeSeconds: candidate.timeSeconds,
          achievedAt,
          sessionId,
          sessionSetId: candidate.sessionSetId,
        },
        select: { id: true },
      });

      bestByKey.set(key, candidate.value);

      if (!isFirstEver) {
        detected.push({
          id: record.id,
          type: candidate.type,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.nameSnapshot,
          value: candidate.value,
          previousValue: previous,
          weightKg: candidate.weightKg,
          reps: candidate.reps,
          achievedAt: achievedAt.toISOString().slice(0, 10),
        });
      }
    }
  }

  return detected;
}

/** Current best per exercise+type - what the PR page and exercise pages show. */
export async function listPersonalRecords(userId: string, exerciseId?: string) {
  const records = await prisma.personalRecord.findMany({
    where: { userId, ...(exerciseId ? { exerciseId } : {}) },
    orderBy: { achievedAt: 'desc' },
    select: {
      id: true,
      type: true,
      value: true,
      previousValue: true,
      weightKg: true,
      reps: true,
      timeSeconds: true,
      achievedAt: true,
      sessionId: true,
      exercise: {
        select: {
          id: true,
          slug: true,
          name: true,
          thumbnailUrl: true,
          primaryMuscle: { select: { id: true, slug: true, name: true, colorHex: true } },
        },
      },
    },
  });

  const current = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    const key = `${record.exercise.id}:${record.type}`;
    if (!current.has(key)) current.set(key, record);
  }

  const serialize = (r: (typeof records)[number]) => ({
    id: r.id,
    type: r.type,
    value: num(r.value) ?? 0,
    previousValue: num(r.previousValue),
    weightKg: num(r.weightKg),
    reps: r.reps,
    timeSeconds: r.timeSeconds,
    // Dates travel as YYYY-MM-DD - the session's marked day, immune to timezone drift.
    achievedAt: r.achievedAt.toISOString().slice(0, 10),
    sessionId: r.sessionId,
    exercise: r.exercise,
  });

  return {
    current: [...current.values()].map(serialize),
    history: records.map(serialize),
  };
}

/** Most recently broken records, for the dashboard card. */
export async function recentPersonalRecords(userId: string, limit = 5) {
  const records = await prisma.personalRecord.findMany({
    where: { userId, previousValue: { not: null }, session: { status: SessionStatus.COMPLETED } },
    orderBy: { achievedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      value: true,
      previousValue: true,
      weightKg: true,
      reps: true,
      achievedAt: true,
      exercise: { select: { id: true, slug: true, name: true } },
    },
  });

  return records.map((r) => ({
    id: r.id,
    type: r.type,
    value: num(r.value) ?? 0,
    previousValue: num(r.previousValue),
    weightKg: num(r.weightKg),
    reps: r.reps,
    achievedAt: r.achievedAt.toISOString().slice(0, 10),
    exercise: r.exercise,
  }));
}
