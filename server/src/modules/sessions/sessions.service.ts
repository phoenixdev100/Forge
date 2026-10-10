import type { z } from 'zod';
import { Prisma, prisma } from '../../db/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { parseIsoDate, todayFor } from '../../lib/dates.js';
import { num } from '../../lib/serialize.js';
import { countsTowardVolume, deriveSetMetrics } from '../../lib/strength.js';
import { suggestProgression, type ProgressionHint } from '../../lib/progression.js';
import {
  PlanDayType,
  PublishStatus,
  SessionStatus,
  SetType,
  TrackingType,
} from '../../generated/prisma/enums.js';
import { resolveDate } from '../schedule/schedule.service.js';
import { detectPersonalRecords } from '../progress/records.service.js';
import {
  sessionExerciseSelect,
  sessionSelect,
  serializeSession,
  serializeSessionExercise,
  serializeSet,
} from './sessions.serializer.js';
import type {
  addSessionExerciseSchema,
  addSetSchema,
  completeSessionSchema,
  listSessionsQuery,
  logSetSchema,
  startSessionSchema,
  swapSessionExerciseSchema,
  updateSessionExerciseSchema,
  updateSessionSchema,
} from './sessions.schemas.js';

function patch<T extends object>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as T;
}

// ---------------------------------------------------------------------------
// Ownership guards
// ---------------------------------------------------------------------------

async function assertSession(userId: string, sessionId: string, mustBeEditable = false) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, status: true, startedAt: true, completedAt: true, durationSeconds: true, date: true, unit: true },
  });
  if (!session) throw notFound('workout');
  if (mustBeEditable && session.status !== SessionStatus.IN_PROGRESS) {
    // History is immutable: a finished workout records what actually happened.
    throw conflict('This workout is already finished, so it cannot be changed.', 'SESSION_FINISHED');
  }
  return session;
}

async function assertSessionExercise(userId: string, id: string, mustBeEditable = true) {
  const row = await prisma.sessionExercise.findFirst({
    where: { id, session: { userId } },
    select: {
      id: true,
      sessionId: true,
      sortOrder: true,
      exerciseId: true,
      trackingType: true,
      session: { select: { status: true } },
    },
  });
  if (!row) throw notFound('exercise in this workout');
  if (mustBeEditable && row.session.status !== SessionStatus.IN_PROGRESS) {
    throw conflict('This workout is already finished, so it cannot be changed.', 'SESSION_FINISHED');
  }
  return row;
}

async function assertSet(userId: string, setId: string) {
  const row = await prisma.sessionSet.findFirst({
    where: { id: setId, sessionExercise: { session: { userId } } },
    select: {
      id: true,
      setNumber: true,
      setType: true,
      weightKg: true,
      reps: true,
      sessionExerciseId: true,
      sessionExercise: {
        select: { id: true, trackingType: true, sessionId: true, session: { select: { status: true } } },
      },
    },
  });
  if (!row) throw notFound('set');
  if (row.sessionExercise.session.status !== SessionStatus.IN_PROGRESS) {
    throw conflict('This workout is already finished, so it cannot be changed.', 'SESSION_FINISHED');
  }
  return row;
}

// ---------------------------------------------------------------------------
// Starting a workout
// ---------------------------------------------------------------------------

/**
 * Starts (or resumes) the workout for a date.
 *
 * The session SNAPSHOTS the plan: exercise names, targets and tracking types
 * are copied onto the session rows. Editing the plan afterwards - or deleting
 * it entirely - cannot rewrite what this session recorded.
 *
 * Blank sets are pre-created from the plan's targets so workout mode has rows
 * to type into immediately, but they are only blanks: the user can change any
 * value, add more, or delete them.
 */
export async function startSession(userId: string, input: z.infer<typeof startSessionSchema>) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true, unit: true },
  });

  const dateIso = input.date ?? todayFor(user.timezone).toISOString().slice(0, 10);
  const date = parseIsoDate(dateIso);

  // Resuming beats starting a duplicate: closing the app mid-workout must not
  // lose the sets already logged.
  const existing = await prisma.workoutSession.findFirst({
    where: { userId, date, status: SessionStatus.IN_PROGRESS },
    select: { id: true },
  });
  if (existing) return getSession(userId, existing.id);

  const scheduled = await resolveDate(userId, dateIso);

  let planDayId: string | null = null;
  if (!input.blank) {
    planDayId = input.planDayId ?? scheduled.scheduled?.planDayId ?? null;
  }

  const planDay = planDayId
    ? await prisma.planDay.findFirst({
        where: { id: planDayId, plan: { userId } },
        select: {
          id: true,
          label: true,
          dayType: true,
          planId: true,
          muscleGroups: {
            orderBy: { sortOrder: 'asc' },
            select: { sortOrder: true, muscleGroup: { select: { id: true, name: true } } },
          },
          exercises: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              sortOrder: true,
              muscleGroupId: true,
              targetSets: true,
              targetRepsMin: true,
              targetRepsMax: true,
              targetWeightKg: true,
              restSeconds: true,
              trackingType: true,
              notes: true,
              supersetKey: true,
              exercise: { select: { id: true, name: true, trackingType: true, defaultRestSeconds: true } },
              plannedSets: {
                orderBy: { setNumber: 'asc' },
                select: {
                  setNumber: true,
                  setType: true,
                  targetWeightKg: true,
                  targetReps: true,
                  targetTimeSeconds: true,
                  targetDistanceM: true,
                },
              },
            },
          },
        },
      })
    : null;

  if (planDayId && !planDay) throw notFound('workout day');
  if (planDay?.dayType === PlanDayType.REST && !input.title) {
    throw badRequest('That day is scheduled as rest. Start a blank workout instead if you want to train.');
  }

  const groups = planDay?.muscleGroups ?? [];
  const title =
    input.title?.trim() ||
    planDay?.label?.trim() ||
    (groups.length ? groups.map((g) => g.muscleGroup.name).join(' + ') : 'Custom workout');

  const session = await prisma.workoutSession.create({
    data: {
      userId,
      date,
      title,
      unit: user.unit,
      status: SessionStatus.IN_PROGRESS,
      planId: planDay?.planId ?? null,
      planDayId: planDay?.id ?? null,
      muscleGroups: {
        create: groups.map((g) => ({
          muscleGroupId: g.muscleGroup.id,
          sortOrder: g.sortOrder,
          nameSnapshot: g.muscleGroup.name,
        })),
      },
      exercises: {
        create: (planDay?.exercises ?? []).map((pe) => {
          const trackingType = pe.trackingType ?? pe.exercise.trackingType;
          const plannedSetCount = pe.plannedSets.length || pe.targetSets || 0;

          return {
            exerciseId: pe.exercise.id,
            planExerciseId: pe.id,
            muscleGroupId: pe.muscleGroupId,
            sortOrder: pe.sortOrder,
            nameSnapshot: pe.exercise.name,
            trackingType,
            targetSets: pe.targetSets,
            targetRepsMin: pe.targetRepsMin,
            targetRepsMax: pe.targetRepsMax,
            targetWeightKg: pe.targetWeightKg,
            restSeconds: pe.restSeconds ?? pe.exercise.defaultRestSeconds,
            notes: pe.notes,
            supersetKey: pe.supersetKey,
            sets: {
              create: Array.from({ length: plannedSetCount }, (_, index) => {
                const planned = pe.plannedSets[index];
                return {
                  setNumber: index + 1,
                  setType: planned?.setType ?? SetType.NORMAL,
                  // Pre-filled with the target as a starting point only.
                  weightKg: planned?.targetWeightKg ?? pe.targetWeightKg ?? null,
                  reps: planned?.targetReps ?? pe.targetRepsMin ?? null,
                  timeSeconds: planned?.targetTimeSeconds ?? null,
                  distanceM: planned?.targetDistanceM ?? null,
                  isCompleted: false,
                };
              }),
            },
          };
        }),
      },
    },
    select: { id: true },
  });

  return getSession(userId, session.id);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function getSession(userId: string, sessionId: string) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    select: sessionSelect,
  });
  if (!session) throw notFound('workout');

  const previous = await getPreviousPerformance(
    userId,
    session.exercises.map((e) => e.exercise.id),
    sessionId,
  );

  // Coaching, keyed by session exercise: what to aim for this time, based on
  // the same numbers the user can already see under "last time".
  const progression: Record<string, ProgressionHint> = {};
  for (const exercise of session.exercises) {
    const hint = suggestProgression({
      trackingType: exercise.trackingType,
      targetRepsMin: exercise.targetRepsMin,
      targetRepsMax: exercise.targetRepsMax,
      previousSets: previous[exercise.exercise.id]?.sets ?? null,
    });
    if (hint) progression[exercise.id] = hint;
  }

  return {
    ...serializeSession(session as never),
    previousPerformance: previous,
    progression,
  };
}

export async function getActiveSession(userId: string) {
  const active = await prisma.workoutSession.findFirst({
    where: { userId, status: SessionStatus.IN_PROGRESS },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  });
  return active ? getSession(userId, active.id) : null;
}

export type PreviousPerformance = {
  exerciseId: string;
  sessionId: string;
  date: string;
  title: string;
  sets: Array<{
    setNumber: number;
    setType: SetType;
    weightKg: number | null;
    reps: number | null;
    timeSeconds: number | null;
    distanceM: number | null;
  }>;
  bestSet: { weightKg: number | null; reps: number | null; estimatedOneRmKg: number | null } | null;
  totalVolumeKg: number;
};

/**
 * "Last time you did this" - looked up per exercise from the most recent
 * COMPLETED session, so the user can see progression without remembering it.
 */
export async function getPreviousPerformance(
  userId: string,
  exerciseIds: string[],
  excludeSessionId?: string,
): Promise<Record<string, PreviousPerformance>> {
  if (!exerciseIds.length) return {};

  const rows = await prisma.sessionExercise.findMany({
    where: {
      exerciseId: { in: [...new Set(exerciseIds)] },
      session: {
        userId,
        status: SessionStatus.COMPLETED,
        ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      },
      sets: { some: { isCompleted: true } },
    },
    orderBy: [{ session: { date: 'desc' } }, { session: { completedAt: 'desc' } }],
    select: {
      exerciseId: true,
      sessionId: true,
      session: { select: { date: true, title: true } },
      sets: {
        where: { isCompleted: true },
        orderBy: { setNumber: 'asc' },
        select: {
          setNumber: true,
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

  const out: Record<string, PreviousPerformance> = {};
  for (const row of rows) {
    // Ordered newest-first, so the first hit per exercise is the latest.
    if (out[row.exerciseId]) continue;

    const working = row.sets.filter((s) => countsTowardVolume(s.setType));
    const best = working.reduce<(typeof working)[number] | null>((bestSoFar, set) => {
      if (!bestSoFar) return set;
      return (num(set.estimatedOneRmKg) ?? 0) > (num(bestSoFar.estimatedOneRmKg) ?? 0) ? set : bestSoFar;
    }, null);

    out[row.exerciseId] = {
      exerciseId: row.exerciseId,
      sessionId: row.sessionId,
      date: row.session.date.toISOString().slice(0, 10),
      title: row.session.title,
      sets: row.sets.map((s) => ({
        setNumber: s.setNumber,
        setType: s.setType,
        weightKg: num(s.weightKg),
        reps: s.reps,
        timeSeconds: s.timeSeconds,
        distanceM: num(s.distanceM),
      })),
      bestSet: best
        ? { weightKg: num(best.weightKg), reps: best.reps, estimatedOneRmKg: num(best.estimatedOneRmKg) }
        : null,
      totalVolumeKg: row.sets.reduce((sum, s) => sum + (num(s.volumeKg) ?? 0), 0),
    };
  }

  return out;
}

export async function listSessions(userId: string, query: z.infer<typeof listSessionsQuery>) {
  const where: Prisma.WorkoutSessionWhereInput = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          date: {
            ...(query.from ? { gte: parseIsoDate(query.from) } : {}),
            ...(query.to ? { lte: parseIsoDate(query.to) } : {}),
          },
        }
      : {}),
    ...(query.exerciseId ? { exercises: { some: { exerciseId: query.exerciseId } } } : {}),
  };

  const [total, sessions] = await Promise.all([
    prisma.workoutSession.count({ where }),
    prisma.workoutSession.findMany({
      where,
      orderBy: [{ date: 'desc' }, { startedAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        date: true,
        title: true,
        status: true,
        startedAt: true,
        completedAt: true,
        durationSeconds: true,
        totalVolumeKg: true,
        totalSets: true,
        totalReps: true,
        prCount: true,
        feeling: true,
        notes: true,
        muscleGroups: {
          orderBy: { sortOrder: 'asc' },
          select: { nameSnapshot: true, muscleGroup: { select: { id: true, slug: true, name: true, colorHex: true } } },
        },
        _count: { select: { exercises: true } },
      },
    }),
  ]);

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      title: s.title,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      durationSeconds: s.durationSeconds,
      totalVolumeKg: num(s.totalVolumeKg),
      totalSets: s.totalSets,
      totalReps: s.totalReps,
      prCount: s.prCount,
      feeling: s.feeling,
      notes: s.notes,
      muscleGroups: s.muscleGroups.map((m) => m.muscleGroup),
      exerciseCount: s._count.exercises,
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

// ---------------------------------------------------------------------------
// Mutating an in-progress workout
// ---------------------------------------------------------------------------

export async function updateSession(userId: string, sessionId: string, input: z.infer<typeof updateSessionSchema>) {
  await assertSession(userId, sessionId);
  await prisma.workoutSession.update({ where: { id: sessionId }, data: patch(input) });
  return getSession(userId, sessionId);
}

/** Adds an exercise that was not in the plan, mid-workout. */
export async function addSessionExercise(
  userId: string,
  sessionId: string,
  input: z.infer<typeof addSessionExerciseSchema>,
) {
  await assertSession(userId, sessionId, true);

  const exercise = await prisma.exercise.findFirst({
    where: {
      id: input.exerciseId,
      OR: [
        { isCustom: false, status: PublishStatus.PUBLISHED },
        { isCustom: true, createdById: userId },
      ],
    },
    select: { id: true, name: true, trackingType: true, defaultRestSeconds: true },
  });
  if (!exercise) throw notFound('exercise');

  const last = await prisma.sessionExercise.findFirst({
    where: { sessionId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const created = await prisma.sessionExercise.create({
    data: {
      sessionId,
      exerciseId: exercise.id,
      muscleGroupId: input.muscleGroupId ?? null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      nameSnapshot: exercise.name,
      trackingType: input.trackingType ?? exercise.trackingType,
      targetSets: input.sets || null,
      targetRepsMin: input.targetRepsMin ?? null,
      targetRepsMax: input.targetRepsMax ?? null,
      targetWeightKg: input.targetWeightKg ?? null,
      restSeconds: exercise.defaultRestSeconds,
      notes: input.notes ?? null,
      sets: {
        create: Array.from({ length: input.sets }, (_, index) => ({
          setNumber: index + 1,
          setType: SetType.NORMAL,
          weightKg: input.targetWeightKg ?? null,
          reps: input.targetRepsMin ?? null,
        })),
      },
    },
    select: sessionExerciseSelect,
  });

  return serializeSessionExercise(created as never);
}

/**
 * Replaces the exercise in a slot mid-workout (busy machine, tweaked joint).
 *
 * Logged work is never silently rewritten: swapping is refused once a set has
 * been completed, because those numbers belong to the old exercise. The plan
 * link is kept so this still counts as "the plan's third slot, substituted" -
 * and so plan sync does not re-add the original underneath it.
 */
export async function swapSessionExercise(
  userId: string,
  id: string,
  input: z.infer<typeof swapSessionExerciseSchema>,
) {
  const row = await assertSessionExercise(userId, id);

  const completed = await prisma.sessionSet.count({ where: { sessionExerciseId: id, isCompleted: true } });
  if (completed > 0) {
    throw conflict(
      'You have already logged sets on this exercise. Remove it instead if you want to change it.',
      'EXERCISE_ALREADY_LOGGED',
    );
  }

  const exercise = await prisma.exercise.findFirst({
    where: {
      id: input.exerciseId,
      OR: [
        { isCustom: false, status: PublishStatus.PUBLISHED },
        { isCustom: true, createdById: userId },
      ],
    },
    select: { id: true, name: true, trackingType: true, defaultRestSeconds: true },
  });
  if (!exercise) throw notFound('exercise');
  if (exercise.id === row.exerciseId) return getSession(userId, row.sessionId);

  const existingSets = await prisma.sessionSet.count({ where: { sessionExerciseId: id } });
  const setCount = input.keepSets ? Math.max(1, existingSets) : 1;

  await prisma.$transaction([
    // The old blanks were shaped for the old exercise - targets and units may
    // not even apply, so the slot restarts clean.
    prisma.sessionSet.deleteMany({ where: { sessionExerciseId: id } }),
    prisma.sessionExercise.update({
      where: { id },
      data: {
        exerciseId: exercise.id,
        nameSnapshot: exercise.name,
        trackingType: exercise.trackingType,
        targetWeightKg: null,
        restSeconds: exercise.defaultRestSeconds,
        sets: {
          create: Array.from({ length: setCount }, (_, index) => ({
            setNumber: index + 1,
            setType: SetType.NORMAL,
          })),
        },
      },
    }),
  ]);

  return getSession(userId, row.sessionId);
}

export async function updateSessionExercise(
  userId: string,
  id: string,
  input: z.infer<typeof updateSessionExerciseSchema>,
) {
  await assertSessionExercise(userId, id);
  const updated = await prisma.sessionExercise.update({
    where: { id },
    data: patch(input),
    select: sessionExerciseSelect,
  });
  return serializeSessionExercise(updated as never);
}

export async function removeSessionExercise(userId: string, id: string) {
  await assertSessionExercise(userId, id);
  await prisma.sessionExercise.delete({ where: { id } });
}

export async function reorderSessionExercises(userId: string, sessionId: string, orderedIds: string[]) {
  await assertSession(userId, sessionId, true);
  const rows = await prisma.sessionExercise.findMany({ where: { sessionId }, select: { id: true } });
  const known = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw badRequest('The reorder request did not match this workout. Reload and try again.');
  }
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.sessionExercise.update({ where: { id }, data: { sortOrder: index } })),
  );
  return getSession(userId, sessionId);
}

/**
 * Adds an extra set beyond the plan. If the plan said 4 sets and the user
 * feels strong, set 5 is just another row.
 */
export async function addSet(userId: string, sessionExerciseId: string, input: z.infer<typeof addSetSchema>) {
  await assertSessionExercise(userId, sessionExerciseId);

  const last = await prisma.sessionSet.findFirst({
    where: { sessionExerciseId },
    orderBy: { setNumber: 'desc' },
    select: { setNumber: true, weightKg: true, reps: true },
  });

  // Carry the previous set forward as a starting point - one tap to log.
  const weightKg = input.weightKg ?? num(last?.weightKg ?? null);
  const reps = input.reps ?? last?.reps ?? null;

  const created = await prisma.sessionSet.create({
    data: {
      sessionExerciseId,
      setNumber: (last?.setNumber ?? 0) + 1,
      setType: input.setType,
      weightKg,
      reps,
      timeSeconds: input.timeSeconds ?? null,
      distanceM: input.distanceM ?? null,
      isCompleted: input.isCompleted,
      completedAt: input.isCompleted ? new Date() : null,
      ...deriveSetMetrics({ weightKg, reps, setType: input.setType }),
    },
    select: {
      id: true,
      setNumber: true,
      setType: true,
      weightKg: true,
      reps: true,
      timeSeconds: true,
      distanceM: true,
      rpe: true,
      isCompleted: true,
      completedAt: true,
      notes: true,
      volumeKg: true,
      estimatedOneRmKg: true,
    },
  });

  // `targetSets` is deliberately left alone: it is the plan's snapshot, and
  // "planned 4, did 5" is information worth keeping.
  return serializeSet(created as never);
}

/**
 * Logs or edits a single set. Every field is independent: set 3 can be a
 * different weight and rep count from sets 1, 2 and 4.
 */
export async function logSet(userId: string, setId: string, input: z.infer<typeof logSetSchema>) {
  const existing = await assertSet(userId, setId);

  const setType = input.setType ?? existing.setType;
  const weightKg = input.weightKg === undefined ? num(existing.weightKg) : input.weightKg;
  const reps = input.reps === undefined ? existing.reps : input.reps;
  const completing = input.isCompleted;

  const updated = await prisma.sessionSet.update({
    where: { id: setId },
    data: {
      ...patch({
        setType: input.setType,
        timeSeconds: input.timeSeconds,
        distanceM: input.distanceM,
        rpe: input.rpe,
        notes: input.notes,
        isCompleted: input.isCompleted,
      }),
      ...(input.weightKg === undefined ? {} : { weightKg: input.weightKg }),
      ...(input.reps === undefined ? {} : { reps: input.reps }),
      ...(completing === undefined ? {} : { completedAt: completing ? new Date() : null }),
      ...deriveSetMetrics({ weightKg, reps, setType }),
    },
    select: {
      id: true,
      setNumber: true,
      setType: true,
      weightKg: true,
      reps: true,
      timeSeconds: true,
      distanceM: true,
      rpe: true,
      isCompleted: true,
      completedAt: true,
      notes: true,
      volumeKg: true,
      estimatedOneRmKg: true,
    },
  });

  // Mark the exercise finished once every one of its sets is logged.
  const [total, done] = await Promise.all([
    prisma.sessionSet.count({ where: { sessionExerciseId: existing.sessionExerciseId } }),
    prisma.sessionSet.count({ where: { sessionExerciseId: existing.sessionExerciseId, isCompleted: true } }),
  ]);
  await prisma.sessionExercise.update({
    where: { id: existing.sessionExerciseId },
    data: { completedAt: total > 0 && total === done ? new Date() : null },
  });

  return serializeSet(updated as never);
}

export async function deleteSet(userId: string, setId: string) {
  const existing = await assertSet(userId, setId);

  await prisma.$transaction(async (tx) => {
    await tx.sessionSet.delete({ where: { id: setId } });
    // Close the numbering gap so set numbers stay 1..n.
    const remaining = await tx.sessionSet.findMany({
      where: { sessionExerciseId: existing.sessionExerciseId },
      orderBy: { setNumber: 'asc' },
      select: { id: true, setNumber: true },
    });
    for (const [index, set] of remaining.entries()) {
      if (set.setNumber !== index + 1) {
        await tx.sessionSet.update({ where: { id: set.id }, data: { setNumber: index + 1 } });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

/**
 * Finalises the workout: discards untouched blank sets, writes the
 * denormalised rollups the dashboard reads, detects personal records, and
 * locks the session as history.
 */
export async function completeSession(
  userId: string,
  sessionId: string,
  input: z.infer<typeof completeSessionSchema>,
) {
  const session = await assertSession(userId, sessionId, true);

  if (input.discardEmptySets) {
    await prisma.sessionSet.deleteMany({
      where: {
        sessionExercise: { sessionId },
        isCompleted: false,
        OR: [
          { reps: null, timeSeconds: null, distanceM: null },
          { reps: 0, timeSeconds: null, distanceM: null },
        ],
      },
    });
  }

  const exercises = await prisma.sessionExercise.findMany({
    where: { sessionId },
    select: {
      id: true,
      exerciseId: true,
      trackingType: true,
      sets: {
        select: {
          id: true,
          setType: true,
          weightKg: true,
          reps: true,
          timeSeconds: true,
          distanceM: true,
          volumeKg: true,
          estimatedOneRmKg: true,
          isCompleted: true,
        },
      },
    },
  });

  // Anything still filled in but not ticked counts as done - a user who typed
  // their numbers and hit "Finish" should not lose the set.
  const implicitlyCompleted = exercises.flatMap((e) =>
    e.sets
      .filter((s) => !s.isCompleted && (s.reps != null || s.timeSeconds != null || s.distanceM != null))
      .map((s) => s.id),
  );
  if (implicitlyCompleted.length) {
    await prisma.sessionSet.updateMany({
      where: { id: { in: implicitlyCompleted } },
      data: { isCompleted: true, completedAt: new Date() },
    });
  }

  const completedSets = exercises.flatMap((e) =>
    e.sets
      .filter((s) => s.isCompleted || implicitlyCompleted.includes(s.id))
      .map((s) => ({ ...s, exerciseId: e.exerciseId, trackingType: e.trackingType })),
  );

  const working = completedSets.filter((s) => countsTowardVolume(s.setType));
  const totalVolumeKg = working.reduce((sum, s) => sum + (num(s.volumeKg) ?? 0), 0);
  const totalReps = working.reduce((sum, s) => sum + (s.reps ?? 0), 0);

  // A reopened workout keeps its original completion timestamp - editing
  // history must not make an old session look like it happened today.
  const completedAt = session.completedAt ?? new Date();
  const durationSeconds =
    input.durationSeconds ??
    session.durationSeconds ??
    Math.max(0, Math.round((completedAt.getTime() - session.startedAt.getTime()) / 1000));

  // Records belong to the day the workout was logged FOR, not the moment the
  // user pressed Finish - backfilling yesterday's session must not misdate PRs.
  const records = await detectPersonalRecords(userId, sessionId, session.date);

  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      status: SessionStatus.COMPLETED,
      completedAt,
      durationSeconds,
      totalVolumeKg,
      totalSets: working.length,
      totalReps,
      prCount: records.length,
      ...patch({ notes: input.notes, feeling: input.feeling }),
    },
  });

  const full = await getSession(userId, sessionId);
  return { session: full, personalRecords: records };
}

export async function abandonSession(userId: string, sessionId: string) {
  await assertSession(userId, sessionId, true);
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { status: SessionStatus.ABANDONED, completedAt: new Date() },
  });
}

/**
 * Reopens a finished workout so the user can fix it - a missed set tick, a
 * wrong weight, an exercise they forgot. The session's PR rows are deleted
 * here and re-detected by completeSession, so records always match what the
 * session actually contains now.
 */
export async function reopenSession(userId: string, sessionId: string) {
  const session = await assertSession(userId, sessionId);
  if (session.status !== SessionStatus.COMPLETED) {
    throw conflict('Only a finished workout can be reopened for editing.', 'SESSION_NOT_FINISHED');
  }

  // Only one workout can be live at a time.
  const active = await prisma.workoutSession.findFirst({
    where: { userId, status: SessionStatus.IN_PROGRESS },
    select: { id: true },
  });
  if (active) {
    throw conflict('Finish or abandon your active workout before editing a past one.', 'SESSION_ACTIVE');
  }

  await prisma.$transaction([
    prisma.personalRecord.deleteMany({ where: { sessionId } }),
    prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.IN_PROGRESS, prCount: 0 },
    }),
  ]);

  return getSession(userId, sessionId);
}

/** Deleting history is the user's right, but it is always explicit. */
export async function deleteSession(userId: string, sessionId: string) {
  await assertSession(userId, sessionId);
  await prisma.workoutSession.delete({ where: { id: sessionId } });
}
