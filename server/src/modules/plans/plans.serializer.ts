import { positionLabel } from '../../lib/dates.js';
import { dateOnly, iso, num } from '../../lib/serialize.js';
import { serializeExercise } from '../exercises/exercises.serializer.js';

const muscleSelect = { id: true, slug: true, name: true, colorHex: true, bodyRegion: true } as const;

export const planExerciseSelect = {
  id: true,
  sortOrder: true,
  muscleGroupId: true,
  targetSets: true,
  targetRepsMin: true,
  targetRepsMax: true,
  targetWeightKg: true,
  targetTimeSeconds: true,
  targetDistanceM: true,
  targetRpe: true,
  restSeconds: true,
  trackingType: true,
  notes: true,
  supersetKey: true,
  exercise: {
    select: {
      id: true,
      slug: true,
      name: true,
      trackingType: true,
      difficulty: true,
      mechanic: true,
      movementType: true,
      isUnilateral: true,
      defaultRestSeconds: true,
      thumbnailUrl: true,
      mediaUrl: true,
      mediaType: true,
      isCustom: true,
      primaryMuscle: { select: muscleSelect },
      equipment: { select: { id: true, slug: true, name: true, iconKey: true } },
    },
  },
  plannedSets: {
    orderBy: { setNumber: 'asc' },
    select: {
      id: true,
      setNumber: true,
      setType: true,
      targetReps: true,
      targetRepsMax: true,
      targetWeightKg: true,
      targetTimeSeconds: true,
      targetDistanceM: true,
      targetRpe: true,
      restSeconds: true,
      notes: true,
    },
  },
} as const;

export const planDaySelect = {
  id: true,
  position: true,
  label: true,
  dayType: true,
  notes: true,
  estimatedMinutes: true,
  muscleGroups: {
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true, muscleGroup: { select: muscleSelect } },
  },
  exercises: { orderBy: { sortOrder: 'asc' }, select: planExerciseSelect },
} as const;

export const planSelect = {
  id: true,
  name: true,
  description: true,
  cycleLength: true,
  startsOn: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  days: { orderBy: { position: 'asc' }, select: planDaySelect },
} as const;

type RawPlanExercise = {
  targetWeightKg: unknown;
  targetDistanceM: unknown;
  targetRpe: unknown;
  exercise: Parameters<typeof serializeExercise>[0] & Record<string, unknown>;
  plannedSets: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export function serializePlanExercise(pe: RawPlanExercise) {
  const { exercise, plannedSets, ...rest } = pe;
  return {
    ...rest,
    targetWeightKg: num(pe.targetWeightKg as never),
    targetDistanceM: num(pe.targetDistanceM as never),
    targetRpe: num(pe.targetRpe as never),
    /** Falls back to the exercise's own tracking type when not overridden. */
    effectiveTrackingType: (pe.trackingType ?? exercise.trackingType) as string,
    effectiveRestSeconds: (pe.restSeconds ?? exercise.defaultRestSeconds) as number,
    exercise: serializeExercise(exercise),
    plannedSets: plannedSets.map((s) => ({
      ...s,
      targetWeightKg: num(s.targetWeightKg as never),
      targetDistanceM: num(s.targetDistanceM as never),
      targetRpe: num(s.targetRpe as never),
    })),
  };
}

type RawMuscleGroup = { id: string; slug: string; name: string; colorHex: string; bodyRegion: string };

type RawPlanDay = {
  position: number;
  label: string | null;
  dayType: string;
  muscleGroups: Array<{ id: string; sortOrder: number; muscleGroup: RawMuscleGroup }>;
  exercises: RawPlanExercise[];
  [key: string]: unknown;
};

export function serializePlanDay(day: RawPlanDay, cycleLength: number, weekStartsOn: number) {
  const groups = day.muscleGroups.map((m) => m.muscleGroup);
  return {
    ...day,
    muscleGroups: day.muscleGroups.map((m) => ({ ...m.muscleGroup, sortOrder: m.sortOrder, rowId: m.id })),
    exercises: day.exercises.map(serializePlanExercise),
    /** "Monday" / "Day 3" - what the calendar and dashboard headers show. */
    positionLabel: positionLabel(day.position, cycleLength, weekStartsOn),
    /**
     * The label falls back to the joined muscle groups ("Chest + Triceps") but
     * an explicit label always wins, so renaming a day sticks.
     */
    displayLabel:
      day.label?.trim() ||
      (groups.length ? groups.map((g) => g.name).join(' + ') : day.dayType === 'REST' ? 'Rest' : 'Custom workout'),
    exerciseCount: day.exercises.length,
    plannedSetCount: day.exercises.reduce(
      (sum, e) => sum + ((e.targetSets as number | null) ?? e.plannedSets.length ?? 0),
      0,
    ),
  };
}

type RawPlan = {
  cycleLength: number;
  startsOn: Date | null;
  createdAt: Date;
  updatedAt: Date;
  days: RawPlanDay[];
  [key: string]: unknown;
};

export function serializePlan(plan: RawPlan, weekStartsOn: number) {
  const days = plan.days.map((d) => serializePlanDay(d, plan.cycleLength, weekStartsOn));
  return {
    ...plan,
    startsOn: dateOnly(plan.startsOn),
    createdAt: iso(plan.createdAt),
    updatedAt: iso(plan.updatedAt),
    days,
    workoutDayCount: days.filter((d) => d.dayType === 'WORKOUT').length,
    totalExerciseCount: days.reduce((sum, d) => sum + d.exerciseCount, 0),
  };
}
