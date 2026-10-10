import { prisma } from '../../db/prisma.js';
import { num } from '../../lib/serialize.js';
import { serializeUser } from './users.serializer.js';

/**
 * A complete, human-readable copy of everything the user put into Forge.
 *
 * Deliberately denormalised and snapshot-based: the export must still make
 * sense years later in a spreadsheet, with no Forge and no ID lookups needed.
 */
export async function buildExport(userId: string) {
  const [user, plans, sessions, records, goals, measurements] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.workoutPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        description: true,
        cycleLength: true,
        startsOn: true,
        isActive: true,
        createdAt: true,
        days: {
          orderBy: { position: 'asc' },
          select: {
            position: true,
            label: true,
            dayType: true,
            notes: true,
            muscleGroups: { orderBy: { sortOrder: 'asc' }, select: { muscleGroup: { select: { name: true } } } },
            exercises: {
              orderBy: { sortOrder: 'asc' },
              select: {
                sortOrder: true,
                targetSets: true,
                targetRepsMin: true,
                targetRepsMax: true,
                targetWeightKg: true,
                restSeconds: true,
                supersetKey: true,
                notes: true,
                exercise: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        title: true,
        status: true,
        startedAt: true,
        completedAt: true,
        durationSeconds: true,
        unit: true,
        notes: true,
        feeling: true,
        totalVolumeKg: true,
        totalSets: true,
        totalReps: true,
        prCount: true,
        muscleGroups: { orderBy: { sortOrder: 'asc' }, select: { nameSnapshot: true } },
        exercises: {
          orderBy: { sortOrder: 'asc' },
          select: {
            nameSnapshot: true,
            trackingType: true,
            sortOrder: true,
            supersetKey: true,
            isSkipped: true,
            notes: true,
            sets: {
              orderBy: { setNumber: 'asc' },
              select: {
                setNumber: true,
                setType: true,
                weightKg: true,
                reps: true,
                timeSeconds: true,
                distanceM: true,
                rpe: true,
                isCompleted: true,
                volumeKg: true,
                estimatedOneRmKg: true,
              },
            },
          },
        },
      },
    }),
    prisma.personalRecord.findMany({
      where: { userId },
      orderBy: { achievedAt: 'asc' },
      select: {
        type: true,
        value: true,
        previousValue: true,
        weightKg: true,
        reps: true,
        timeSeconds: true,
        achievedAt: true,
        exercise: { select: { name: true } },
      },
    }),
    prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        title: true,
        metric: true,
        status: true,
        targetValue: true,
        startValue: true,
        currentValue: true,
        unitLabel: true,
        deadline: true,
        achievedAt: true,
        notes: true,
        exercise: { select: { name: true } },
      },
    }),
    prisma.bodyMeasurement.findMany({ where: { userId }, orderBy: { measuredOn: 'asc' } }),
  ]);

  // Columns backed by Postgres `date` are calendar days, not instants - they
  // must not pick up a misleading 00:00:00Z time in the export.
  const DATE_ONLY_KEYS = new Set(['date', 'achievedAt', 'deadline', 'measuredOn', 'startsOn', 'targetDate']);

  // Decimal and Date values become plain numbers and ISO strings, so the JSON
  // is readable anywhere - not just inside a Prisma client.
  const plain = (value: unknown, key?: string): unknown => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) {
      return key && DATE_ONLY_KEYS.has(key) ? value.toISOString().slice(0, 10) : value.toISOString();
    }
    if (Array.isArray(value)) return value.map((item) => plain(item));
    if (typeof value === 'object') {
      // Prisma Decimal - the only object here that is really a number.
      if (typeof (value as { toNumber?: unknown }).toNumber === 'function') return num(value as never);
      return Object.fromEntries(Object.entries(value as object).map(([k, v]) => [k, plain(v, k)]));
    }
    return value;
  };

  return {
    meta: {
      app: 'Forge',
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      note: 'Weights are kilograms, distances metres, times seconds. Dates are ISO.',
    },
    profile: serializeUser(user),
    plans: plain(plans),
    sessions: plain(sessions),
    personalRecords: plain(records),
    goals: plain(goals),
    measurements: plain(measurements),
  };
}

/** Flat one-row-per-set CSV - the shape spreadsheets and other apps expect. */
export async function buildSetsCsv(userId: string) {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      title: true,
      status: true,
      exercises: {
        orderBy: { sortOrder: 'asc' },
        select: {
          nameSnapshot: true,
          trackingType: true,
          sets: {
            orderBy: { setNumber: 'asc' },
            select: {
              setNumber: true,
              setType: true,
              weightKg: true,
              reps: true,
              timeSeconds: true,
              distanceM: true,
              rpe: true,
              isCompleted: true,
            },
          },
        },
      },
    },
  });

  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const rows = [
    ['date', 'workout', 'status', 'exercise', 'tracking', 'set', 'set_type', 'weight_kg', 'reps', 'time_s', 'distance_m', 'rpe', 'completed'],
  ];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        rows.push([
          session.date.toISOString().slice(0, 10),
          session.title,
          session.status,
          exercise.nameSnapshot,
          exercise.trackingType,
          String(set.setNumber),
          set.setType,
          String(num(set.weightKg) ?? ''),
          String(set.reps ?? ''),
          String(set.timeSeconds ?? ''),
          String(num(set.distanceM) ?? ''),
          String(num(set.rpe) ?? ''),
          set.isCompleted ? 'yes' : 'no',
        ]);
      }
    }
  }

  return rows.map((row) => row.map(escape).join(',')).join('\n');
}
