import { z } from 'zod';
import { isoDate } from '../../middleware/validate.js';
import { SessionStatus, SetType, TrackingType } from '../../generated/prisma/enums.js';

/**
 * Weights are always exchanged in kilograms. The client converts once, in a
 * single helper, so the API and database never hold ambiguous numbers.
 */
const weightKg = z.coerce.number().min(0).max(1000);

export const startSessionSchema = z.object({
  /** Defaults to today in the user's timezone. */
  date: isoDate.optional(),
  /** Omit to use whatever the schedule resolves for that date. */
  planDayId: z.string().min(1).nullish(),
  title: z.string().trim().min(1).max(120).optional(),
  /** `true` starts an empty session, ignoring the plan entirely. */
  blank: z.boolean().default(false),
});

export const updateSessionSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().max(2000).nullish(),
    feeling: z.coerce.number().int().min(1).max(5).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const completeSessionSchema = z.object({
  notes: z.string().trim().max(2000).nullish(),
  feeling: z.coerce.number().int().min(1).max(5).nullish(),
  /** Client-measured elapsed time; falls back to startedAt..now. */
  durationSeconds: z.coerce.number().int().min(0).max(86_400).nullish(),
  /** Drop sets that were never filled in instead of keeping them as blanks. */
  discardEmptySets: z.boolean().default(true),
});

export const addSessionExerciseSchema = z.object({
  exerciseId: z.string().min(1, 'Pick an exercise.'),
  muscleGroupId: z.string().min(1).nullish(),
  /** How many blank sets to pre-create so the user can start logging. */
  sets: z.coerce.number().int().min(0).max(50).default(3),
  targetRepsMin: z.coerce.number().int().min(0).max(1000).nullish(),
  targetRepsMax: z.coerce.number().int().min(0).max(1000).nullish(),
  targetWeightKg: weightKg.nullish(),
  trackingType: z.enum(TrackingType).nullish(),
  notes: z.string().trim().max(600).nullish(),
});

export const updateSessionExerciseSchema = z
  .object({
    notes: z.string().trim().max(600).nullish(),
    isSkipped: z.boolean().optional(),
    restSeconds: z.coerce.number().int().min(0).max(1800).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

/** A set's values are all independent - never assume they match its siblings. */
export const logSetSchema = z
  .object({
    weightKg: weightKg.nullish(),
    reps: z.coerce.number().int().min(0).max(1000).nullish(),
    timeSeconds: z.coerce.number().int().min(0).max(86_400).nullish(),
    distanceM: z.coerce.number().min(0).max(1_000_000).nullish(),
    rpe: z.coerce.number().min(1).max(10).nullish(),
    setType: z.enum(SetType).optional(),
    isCompleted: z.boolean().optional(),
    notes: z.string().trim().max(300).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const addSetSchema = z.object({
  setType: z.enum(SetType).default(SetType.NORMAL),
  /** Prefilling from the previous set is a client choice, not a server rule. */
  weightKg: weightKg.nullish(),
  reps: z.coerce.number().int().min(0).max(1000).nullish(),
  timeSeconds: z.coerce.number().int().min(0).max(86_400).nullish(),
  distanceM: z.coerce.number().min(0).max(1_000_000).nullish(),
  isCompleted: z.boolean().default(false),
});

export const reorderSessionExercisesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const listSessionsQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(SessionStatus).optional(),
  exerciseId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
