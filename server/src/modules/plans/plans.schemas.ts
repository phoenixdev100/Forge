import { z } from 'zod';
import { isoDate } from '../../middleware/validate.js';
import { PlanDayType, SetType, TrackingType } from '../../generated/prisma/enums.js';

export const createPlanSchema = z.object({
  name: z.string().trim().min(1, 'Give your plan a name.').max(80),
  description: z.string().trim().max(600).nullish(),
  /** 7 = weekly recurring. Any other length rotates from `startsOn`. */
  cycleLength: z.coerce.number().int().min(1).max(28).default(7),
  startsOn: isoDate.nullish(),
  activate: z.boolean().default(true),
  /** Optional starting point; the copied plan is fully editable afterwards. */
  templateSlug: z.string().min(1).optional(),
});

export const updatePlanSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(600).nullish(),
    cycleLength: z.coerce.number().int().min(1).max(28).optional(),
    startsOn: isoDate.nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const createDaySchema = z.object({
  /** Omit to append at the next free position in the cycle. */
  position: z.coerce.number().int().min(0).max(27).optional(),
  label: z.string().trim().max(80).nullish(),
  dayType: z.enum(PlanDayType).default(PlanDayType.WORKOUT),
  notes: z.string().trim().max(600).nullish(),
  /** A day may start with zero, one, or many muscle groups. */
  muscleGroupIds: z.array(z.string().min(1)).max(20).default([]),
});

export const updateDaySchema = z
  .object({
    position: z.coerce.number().int().min(0).max(27).optional(),
    label: z.string().trim().max(80).nullish(),
    dayType: z.enum(PlanDayType).optional(),
    notes: z.string().trim().max(600).nullish(),
    estimatedMinutes: z.coerce.number().int().min(0).max(600).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const setDayMuscleGroupsSchema = z.object({
  /** Replaces the whole set. Empty array is valid - a fully custom day. */
  muscleGroupIds: z.array(z.string().min(1)).max(20),
});

/** Every target is optional: the plan is a suggestion, not a contract. */
const exerciseTargets = {
  muscleGroupId: z.string().min(1).nullish(),
  targetSets: z.coerce.number().int().min(0).max(50).nullish(),
  targetRepsMin: z.coerce.number().int().min(0).max(1000).nullish(),
  targetRepsMax: z.coerce.number().int().min(0).max(1000).nullish(),
  targetWeightKg: z.coerce.number().min(0).max(1000).nullish(),
  targetTimeSeconds: z.coerce.number().int().min(0).max(86_400).nullish(),
  targetDistanceM: z.coerce.number().min(0).max(1_000_000).nullish(),
  targetRpe: z.coerce.number().min(1).max(10).nullish(),
  restSeconds: z.coerce.number().int().min(0).max(1800).nullish(),
  trackingType: z.enum(TrackingType).nullish(),
  notes: z.string().trim().max(600).nullish(),
  supersetKey: z.string().trim().max(40).nullish(),
};

const repRangeOrder = (v: { targetRepsMin?: number | null; targetRepsMax?: number | null }) =>
  v.targetRepsMin == null || v.targetRepsMax == null || v.targetRepsMin <= v.targetRepsMax;

export const addPlanExerciseSchema = z
  .object({
    exerciseId: z.string().min(1, 'Pick an exercise.'),
    /** Omit to append to the end of the day. */
    sortOrder: z.coerce.number().int().min(0).optional(),
    ...exerciseTargets,
  })
  .refine(repRangeOrder, { message: 'Minimum reps cannot exceed maximum reps.', path: ['targetRepsMin'] });

/** Bulk add - the exercise picker lets you tick several at once. */
export const addPlanExercisesSchema = z.object({
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        muscleGroupId: z.string().min(1).nullish(),
        targetSets: z.coerce.number().int().min(0).max(50).nullish(),
        targetRepsMin: z.coerce.number().int().min(0).max(1000).nullish(),
        targetRepsMax: z.coerce.number().int().min(0).max(1000).nullish(),
      }),
    )
    .min(1, 'Pick at least one exercise.')
    .max(50),
});

export const updatePlanExerciseSchema = z
  .object(exerciseTargets)
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')
  .refine(repRangeOrder, { message: 'Minimum reps cannot exceed maximum reps.', path: ['targetRepsMin'] });

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** Per-set planning for pyramids / ramp-ups. Replaces the full list. */
export const setPlannedSetsSchema = z.object({
  sets: z
    .array(
      z.object({
        setType: z.enum(SetType).default(SetType.NORMAL),
        targetReps: z.coerce.number().int().min(0).max(1000).nullish(),
        targetRepsMax: z.coerce.number().int().min(0).max(1000).nullish(),
        targetWeightKg: z.coerce.number().min(0).max(1000).nullish(),
        targetTimeSeconds: z.coerce.number().int().min(0).max(86_400).nullish(),
        targetDistanceM: z.coerce.number().min(0).max(1_000_000).nullish(),
        targetRpe: z.coerce.number().min(1).max(10).nullish(),
        restSeconds: z.coerce.number().int().min(0).max(1800).nullish(),
        notes: z.string().trim().max(300).nullish(),
      }),
    )
    .max(50),
});

export const duplicateDaySchema = z.object({
  position: z.coerce.number().int().min(0).max(27).optional(),
  label: z.string().trim().max(80).nullish(),
});

export const scheduleRangeQuery = z.object({
  from: isoDate,
  to: isoDate,
});

/** Changes one calendar date without touching the recurring plan. */
export const scheduleOverrideSchema = z
  .object({
    planDayId: z.string().min(1).nullish(),
    isRest: z.boolean().default(false),
    note: z.string().trim().max(300).nullish(),
  })
  .refine((v) => !(v.isRest && v.planDayId), 'A date cannot be a rest day and a workout at the same time.');
