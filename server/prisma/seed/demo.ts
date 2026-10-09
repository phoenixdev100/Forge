import { prisma } from '../../src/db/prisma.js';
import { addDays, parseIsoDate, startOfWeek, toIsoDate } from '../../src/lib/dates.js';
import { deriveSetMetrics } from '../../src/lib/strength.js';
import { detectPersonalRecords } from '../../src/modules/progress/records.service.js';
import {
  PlanDayType,
  SessionStatus,
  SetType,
  TrackingType,
  UnitSystem,
} from '../../src/generated/prisma/enums.js';

/**
 * Demo plan, deliberately irregular to prove the model forces nothing:
 * one day has a single muscle group, others have two or three, and the
 * exercise counts differ per day.
 */
const DEMO_DAYS: Array<{
  position: number;
  label: string | null;
  rest?: boolean;
  muscleGroups: string[];
  exercises: Array<{ slug: string; muscleGroup?: string; sets: number; repsMin: number; repsMax: number; startKg: number | null }>;
}> = [
  {
    position: 0, // Monday
    label: null, // falls back to "Chest + Triceps"
    muscleGroups: ['chest', 'triceps'],
    exercises: [
      { slug: 'barbell-bench-press', muscleGroup: 'chest', sets: 4, repsMin: 8, repsMax: 10, startKg: 60 },
      { slug: 'incline-dumbbell-press', muscleGroup: 'chest', sets: 3, repsMin: 10, repsMax: 12, startKg: 20 },
      { slug: 'cable-fly', muscleGroup: 'chest', sets: 3, repsMin: 12, repsMax: 15, startKg: 15 },
      { slug: 'pec-deck', muscleGroup: 'chest', sets: 3, repsMin: 12, repsMax: 15, startKg: 40 },
      { slug: 'rope-pushdown', muscleGroup: 'triceps', sets: 3, repsMin: 10, repsMax: 15, startKg: 25 },
      { slug: 'skull-crusher', muscleGroup: 'triceps', sets: 3, repsMin: 8, repsMax: 12, startKg: 25 },
    ],
  },
  {
    position: 1, // Tuesday
    label: null,
    muscleGroups: ['back', 'biceps'],
    exercises: [
      { slug: 'pull-up', muscleGroup: 'back', sets: 4, repsMin: 6, repsMax: 10, startKg: 0 },
      { slug: 'barbell-row', muscleGroup: 'back', sets: 4, repsMin: 8, repsMax: 10, startKg: 55 },
      { slug: 'lat-pulldown', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 12, startKg: 50 },
      { slug: 'seated-cable-row', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 12, startKg: 45 },
      { slug: 'barbell-curl', muscleGroup: 'biceps', sets: 3, repsMin: 8, repsMax: 12, startKg: 25 },
      { slug: 'hammer-curl', muscleGroup: 'biceps', sets: 3, repsMin: 10, repsMax: 12, startKg: 12.5 },
    ],
  },
  { position: 2, label: 'Rest', rest: true, muscleGroups: [], exercises: [] },
  {
    position: 3, // Thursday - a single muscle group, three exercises
    label: null,
    muscleGroups: ['legs'],
    exercises: [
      { slug: 'back-squat', muscleGroup: 'legs', sets: 4, repsMin: 6, repsMax: 8, startKg: 80 },
      { slug: 'romanian-deadlift', muscleGroup: 'legs', sets: 3, repsMin: 8, repsMax: 10, startKg: 70 },
      { slug: 'leg-press', muscleGroup: 'legs', sets: 3, repsMin: 10, repsMax: 15, startKg: 120 },
      { slug: 'lying-leg-curl', muscleGroup: 'legs', sets: 3, repsMin: 10, repsMax: 15, startKg: 35 },
      { slug: 'standing-calf-raise', muscleGroup: 'legs', sets: 4, repsMin: 12, repsMax: 20, startKg: 60 },
    ],
  },
  {
    position: 4, // Friday - three muscle groups
    label: null,
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    exercises: [
      { slug: 'incline-barbell-bench-press', muscleGroup: 'chest', sets: 4, repsMin: 8, repsMax: 10, startKg: 45 },
      { slug: 'dumbbell-bench-press', muscleGroup: 'chest', sets: 3, repsMin: 10, repsMax: 12, startKg: 22.5 },
      { slug: 'overhead-press', muscleGroup: 'shoulders', sets: 4, repsMin: 6, repsMax: 10, startKg: 35 },
      { slug: 'lateral-raise', muscleGroup: 'shoulders', sets: 4, repsMin: 12, repsMax: 15, startKg: 8 },
      { slug: 'face-pull', muscleGroup: 'shoulders', sets: 3, repsMin: 12, repsMax: 15, startKg: 20 },
      { slug: 'triceps-pushdown', muscleGroup: 'triceps', sets: 3, repsMin: 10, repsMax: 15, startKg: 27.5 },
    ],
  },
  {
    position: 5, // Saturday - three muscle groups including abs
    label: null,
    muscleGroups: ['back', 'biceps', 'abs'],
    exercises: [
      { slug: 'deadlift', muscleGroup: 'back', sets: 3, repsMin: 5, repsMax: 5, startKg: 100 },
      { slug: 'one-arm-dumbbell-row', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 12, startKg: 27.5 },
      { slug: 'rear-delt-fly', muscleGroup: 'back', sets: 3, repsMin: 12, repsMax: 15, startKg: 7.5 },
      { slug: 'incline-dumbbell-curl', muscleGroup: 'biceps', sets: 3, repsMin: 10, repsMax: 12, startKg: 10 },
      { slug: 'hanging-leg-raise', muscleGroup: 'abs', sets: 3, repsMin: 8, repsMax: 15, startKg: 0 },
      { slug: 'plank', muscleGroup: 'abs', sets: 3, repsMin: 0, repsMax: 0, startKg: null },
    ],
  },
  { position: 6, label: 'Rest', rest: true, muscleGroups: [], exercises: [] },
];

const WEEKS_OF_HISTORY = 8;

/** Deterministic pseudo-randomness so re-seeding gives the same demo data. */
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

/**
 * Builds a plan plus eight weeks of plausible history for the demo account, so
 * the dashboard, history, progress charts and PR pages all have something real
 * to show on first login.
 */
export async function seedDemoHistory(userId: string) {
  // Idempotent: wipe only this demo user's generated data.
  await prisma.workoutSession.deleteMany({ where: { userId } });
  await prisma.personalRecord.deleteMany({ where: { userId } });
  await prisma.workoutPlan.deleteMany({ where: { userId } });

  const slugs = [...new Set(DEMO_DAYS.flatMap((d) => d.exercises.map((e) => e.slug)))];
  const exercises = new Map(
    (
      await prisma.exercise.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, slug: true, name: true, trackingType: true, defaultRestSeconds: true },
      })
    ).map((e) => [e.slug, e]),
  );

  const groupSlugs = [...new Set(DEMO_DAYS.flatMap((d) => [...d.muscleGroups, ...d.exercises.map((e) => e.muscleGroup ?? '')]))].filter(Boolean);
  const groups = new Map(
    (await prisma.muscleGroup.findMany({ where: { slug: { in: groupSlugs } }, select: { id: true, slug: true, name: true } })).map(
      (g) => [g.slug, g],
    ),
  );

  const plan = await prisma.workoutPlan.create({
    data: {
      userId,
      name: 'My Split',
      description: 'Six days a week, built around the compound lifts.',
      cycleLength: 7,
      isActive: true,
      days: {
        create: DEMO_DAYS.map((day) => ({
          position: day.position,
          label: day.label,
          dayType: day.rest ? PlanDayType.REST : PlanDayType.WORKOUT,
          muscleGroups: {
            create: day.muscleGroups
              .map((slug, index) => ({ muscleGroupId: groups.get(slug)?.id, sortOrder: index }))
              .filter((m): m is { muscleGroupId: string; sortOrder: number } => Boolean(m.muscleGroupId)),
          },
          exercises: {
            create: day.exercises
              .map((e, index) => {
                const exercise = exercises.get(e.slug);
                if (!exercise) return null;
                return {
                  exerciseId: exercise.id,
                  muscleGroupId: e.muscleGroup ? groups.get(e.muscleGroup)?.id ?? null : null,
                  sortOrder: index,
                  targetSets: e.sets,
                  targetRepsMin: e.repsMin || null,
                  targetRepsMax: e.repsMax || null,
                  targetWeightKg: e.startKg,
                  restSeconds: exercise.defaultRestSeconds,
                };
              })
              .filter((v): v is NonNullable<typeof v> => v !== null),
          },
        })),
      },
    },
    select: { id: true, days: { select: { id: true, position: true } } },
  });

  const dayIdByPosition = new Map(plan.days.map((d) => [d.position, d.id]));

  const today = new Date();
  const firstMonday = addDays(startOfWeek(today, 1), -(WEEKS_OF_HISTORY - 1) * 7);
  const random = rng(20_260_314);

  let sessionCount = 0;
  let setCount = 0;

  for (let week = 0; week < WEEKS_OF_HISTORY; week += 1) {
    for (const day of DEMO_DAYS) {
      if (day.rest || !day.exercises.length) continue;

      const date = addDays(firstMonday, week * 7 + day.position);
      if (date > today) continue;
      // Life happens: skip roughly one session a month.
      if (random() < 0.07) continue;

      const planDayId = dayIdByPosition.get(day.position) ?? null;
      const label = day.muscleGroups.map((s) => groups.get(s)?.name).filter(Boolean).join(' + ') || 'Workout';

      const startedAt = new Date(date.getTime() + 18 * 3_600_000);
      const durationSeconds = 2_700 + Math.round(random() * 1_500);
      const completedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

      const sessionExercises = day.exercises
        .map((planned, order) => {
          const exercise = exercises.get(planned.slug);
          if (!exercise) return null;

          const isTimed = exercise.trackingType === TrackingType.TIME;
          // ~2% per week progression, snapped to a loadable increment.
          const progression = 1 + week * 0.02;
          const baseKg = planned.startKg === null ? null : Math.round((planned.startKg * progression) / 1.25) * 1.25;

          // Occasionally push past the plan - the extra-set case must be real data.
          const setTotal = planned.sets + (random() < 0.15 ? 1 : 0);

          const sets = Array.from({ length: setTotal }, (_, index) => {
            if (isTimed) {
              const seconds = 45 + week * 3 + Math.round(random() * 10);
              return {
                setNumber: index + 1,
                setType: SetType.NORMAL,
                weightKg: null,
                reps: null,
                timeSeconds: seconds,
                isCompleted: true,
                completedAt,
                ...deriveSetMetrics({ weightKg: null, reps: null, setType: SetType.NORMAL }),
              };
            }

            // Reps fatigue across the set, and weight sometimes steps up -
            // never assume every set shares a weight or rep count.
            const stepUp = index >= 2 && random() < 0.35 ? 2.5 : 0;
            const weightKg = baseKg === null ? null : baseKg + stepUp;
            const drop = Math.floor(index * (random() < 0.5 ? 0.6 : 1.1));
            const reps = Math.max(
              1,
              (planned.repsMax || planned.repsMin || 10) - drop - (stepUp > 0 ? 2 : 0),
            );

            return {
              setNumber: index + 1,
              setType: SetType.NORMAL,
              weightKg,
              reps,
              timeSeconds: null,
              isCompleted: true,
              completedAt,
              ...deriveSetMetrics({ weightKg, reps, setType: SetType.NORMAL }),
            };
          });

          setCount += sets.length;

          return {
            exerciseId: exercise.id,
            muscleGroupId: planned.muscleGroup ? groups.get(planned.muscleGroup)?.id ?? null : null,
            sortOrder: order,
            nameSnapshot: exercise.name,
            trackingType: exercise.trackingType,
            targetSets: planned.sets,
            targetRepsMin: planned.repsMin || null,
            targetRepsMax: planned.repsMax || null,
            targetWeightKg: baseKg,
            restSeconds: exercise.defaultRestSeconds,
            completedAt,
            sets: { create: sets },
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const session = await prisma.workoutSession.create({
        data: {
          userId,
          planId: plan.id,
          planDayId,
          date: parseIsoDate(toIsoDate(date)),
          title: label,
          status: SessionStatus.COMPLETED,
          unit: UnitSystem.KG,
          startedAt,
          completedAt,
          durationSeconds,
          feeling: 3 + Math.round(random() * 2),
          muscleGroups: {
            create: day.muscleGroups
              .map((slug, index) => {
                const group = groups.get(slug);
                return group ? { muscleGroupId: group.id, sortOrder: index, nameSnapshot: group.name } : null;
              })
              .filter((v): v is NonNullable<typeof v> => v !== null),
          },
          exercises: { create: sessionExercises },
        },
        select: { id: true },
      });

      // Run the real detector in chronological order so the PR history and
      // `previousValue` chain match what the live app would have produced.
      const records = await detectPersonalRecords(userId, session.id, completedAt);

      const totals = await prisma.sessionSet.aggregate({
        where: { sessionExercise: { sessionId: session.id }, isCompleted: true, setType: { not: SetType.WARMUP } },
        _sum: { volumeKg: true, reps: true },
        _count: true,
      });

      await prisma.workoutSession.update({
        where: { id: session.id },
        data: {
          totalVolumeKg: totals._sum.volumeKg ?? 0,
          totalSets: totals._count,
          totalReps: totals._sum.reps ?? 0,
          prCount: records.length,
        },
      });

      sessionCount += 1;
      // One quiet dot per session — remote databases make this phase slow
      // enough that silence reads as "stuck".
      process.stdout.write('.');
    }
  }
  if (sessionCount) process.stdout.write('\n');

  return { sessions: sessionCount, sets: setCount };
}
