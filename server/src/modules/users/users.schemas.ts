import { z } from 'zod';
import { isoDate } from '../../middleware/validate.js';
import {
  ExperienceLevel,
  FitnessGoal,
  Sex,
  UnitSystem,
} from '../../generated/prisma/enums.js';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Tell us your name.').max(80).optional(),
    avatarUrl: z.string().url('Enter a valid image URL.').max(500).nullish(),
    unit: z.enum(UnitSystem).optional(),
    goal: z.enum(FitnessGoal).nullish(),
    experience: z.enum(ExperienceLevel).nullish(),
    trainingDaysPerWeek: z.coerce.number().int().min(1).max(7).nullish(),
    heightCm: z.coerce.number().min(50).max(260).nullish(),
    bodyWeightKg: z.coerce.number().min(20).max(400).nullish(),
    dateOfBirth: isoDate.nullish(),
    sex: z.enum(Sex).nullish(),
    timezone: z.string().min(1).max(64).optional(),
    weekStartsOn: z.coerce.number().int().min(0).max(6).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

/** Every field is optional - onboarding must be skippable. */
export const onboardingSchema = z.object({
  goal: z.enum(FitnessGoal).nullish(),
  experience: z.enum(ExperienceLevel).nullish(),
  trainingDaysPerWeek: z.coerce.number().int().min(1).max(7).nullish(),
  unit: z.enum(UnitSystem).optional(),
  bodyWeightKg: z.coerce.number().min(20).max(400).nullish(),
  heightCm: z.coerce.number().min(50).max(260).nullish(),
  dateOfBirth: isoDate.nullish(),
  sex: z.enum(Sex).nullish(),
  weekStartsOn: z.coerce.number().int().min(0).max(6).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export const exportQuerySchema = z.object({
  /** `json` is the full archive; `csv` is one row per logged set. */
  format: z.enum(['json', 'csv']).default('json'),
});

export const notificationPrefsSchema = z.object({
  workoutReminder: z.boolean().optional(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 18:30.')
    .nullish(),
  upcomingWorkout: z.boolean().optional(),
  goalReminder: z.boolean().optional(),
  prNotification: z.boolean().optional(),
  streakReminder: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});
