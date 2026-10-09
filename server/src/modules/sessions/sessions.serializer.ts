import { dateOnly, iso, num } from '../../lib/serialize.js';
import { serializeExercise } from '../exercises/exercises.serializer.js';

export const sessionSetSelect = {
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
} as const;

export const sessionExerciseSelect = {
  id: true,
  sortOrder: true,
  planExerciseId: true,
  muscleGroupId: true,
  nameSnapshot: true,
  trackingType: true,
  targetSets: true,
  targetRepsMin: true,
  targetRepsMax: true,
  targetWeightKg: true,
  restSeconds: true,
  notes: true,
  isSkipped: true,
  completedAt: true,
  exercise: {
    select: {
      id: true,
      slug: true,
      name: true,
      trackingType: true,
      isUnilateral: true,
      defaultRestSeconds: true,
      thumbnailUrl: true,
      mediaUrl: true,
      mediaType: true,
      primaryMuscle: { select: { id: true, slug: true, name: true, colorHex: true } },
      equipment: { select: { id: true, slug: true, name: true, iconKey: true } },
    },
  },
  muscleGroup: { select: { id: true, slug: true, name: true, colorHex: true } },
  sets: { orderBy: { setNumber: 'asc' }, select: sessionSetSelect },
} as const;

export const sessionSelect = {
  id: true,
  planId: true,
  planDayId: true,
  date: true,
  title: true,
  status: true,
  startedAt: true,
  completedAt: true,
  durationSeconds: true,
  notes: true,
  feeling: true,
  unit: true,
  totalVolumeKg: true,
  totalSets: true,
  totalReps: true,
  prCount: true,
  muscleGroups: {
    orderBy: { sortOrder: 'asc' },
    select: {
      sortOrder: true,
      nameSnapshot: true,
      muscleGroup: { select: { id: true, slug: true, name: true, colorHex: true } },
    },
  },
  exercises: { orderBy: { sortOrder: 'asc' }, select: sessionExerciseSelect },
} as const;

type RawSet = {
  weightKg: unknown;
  distanceM: unknown;
  rpe: unknown;
  volumeKg: unknown;
  estimatedOneRmKg: unknown;
  completedAt: Date | null;
  [key: string]: unknown;
};

export function serializeSet(set: RawSet) {
  return {
    ...set,
    weightKg: num(set.weightKg as never),
    distanceM: num(set.distanceM as never),
    rpe: num(set.rpe as never),
    volumeKg: num(set.volumeKg as never),
    estimatedOneRmKg: num(set.estimatedOneRmKg as never),
    completedAt: iso(set.completedAt),
  };
}

type RawSessionExercise = {
  targetWeightKg: unknown;
  completedAt: Date | null;
  trackingType: string;
  targetSets: number | null;
  isSkipped: boolean;
  exercise: Parameters<typeof serializeExercise>[0] & Record<string, unknown>;
  sets: RawSet[];
  [key: string]: unknown;
};

export function serializeSessionExercise(se: RawSessionExercise) {
  const { exercise, sets, ...rest } = se;
  const working = sets.filter((s) => s.setType !== 'WARMUP');
  const completed = sets.filter((s) => s.isCompleted);

  return {
    ...rest,
    targetWeightKg: num(se.targetWeightKg as never),
    completedAt: iso(se.completedAt),
    exercise: serializeExercise(exercise),
    sets: sets.map(serializeSet),
    /**
     * Planned vs actual, precomputed for the UI. `targetSets` is what the plan
     * asked for; `sets.length` is what the user actually did - they are allowed
     * to differ in either direction.
     */
    progress: {
      plannedSets: se.targetSets ?? null,
      loggedSets: sets.length,
      workingSets: working.length,
      completedSets: completed.length,
      isComplete: sets.length > 0 && completed.length === sets.length,
      volumeKg: sets.reduce((sum, s) => sum + (num(s.volumeKg as never) ?? 0), 0),
    },
  };
}

type RawSession = {
  date: Date;
  startedAt: Date;
  completedAt: Date | null;
  totalVolumeKg: unknown;
  muscleGroups: Array<{ sortOrder: number; nameSnapshot: string; muscleGroup: unknown }>;
  exercises: RawSessionExercise[];
  [key: string]: unknown;
};

export function serializeSession(session: RawSession) {
  const exercises = session.exercises.map(serializeSessionExercise);
  const completedExercises = exercises.filter((e) => e.progress.isComplete || e.isSkipped).length;

  return {
    ...session,
    date: dateOnly(session.date),
    startedAt: iso(session.startedAt),
    completedAt: iso(session.completedAt),
    totalVolumeKg: num(session.totalVolumeKg as never),
    muscleGroups: session.muscleGroups.map((m) => m.muscleGroup),
    exercises,
    summary: {
      exerciseCount: exercises.length,
      completedExerciseCount: completedExercises,
      loggedSetCount: exercises.reduce((sum, e) => sum + e.progress.loggedSets, 0),
      completedSetCount: exercises.reduce((sum, e) => sum + e.progress.completedSets, 0),
      volumeKg: exercises.reduce((sum, e) => sum + e.progress.volumeKg, 0),
    },
  };
}
