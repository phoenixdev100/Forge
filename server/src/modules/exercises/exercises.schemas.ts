import { z } from 'zod';
import {
  Difficulty,
  Mechanic,
  MediaType,
  MovementType,
  PublishStatus,
  TrackingType,
} from '../../generated/prisma/enums.js';

/** Accepts `?muscle=chest&muscle=triceps` and `?muscle=chest,triceps`. */
const csvArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    const list = (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(',')).map((s) => s.trim());
    const unique = [...new Set(list.filter(Boolean))];
    return unique.length ? unique : undefined;
  });

export const listExercisesQuery = z.object({
  q: z.string().trim().max(120).optional(),
  muscle: csvArray,
  equipment: csvArray,
  category: csvArray,
  difficulty: csvArray,
  movementType: csvArray,
  mechanic: csvArray,
  /** Include an exercise when the muscle is worked as a secondary target too. */
  includeSecondary: z.coerce.boolean().default(false),
  /** `mine` = custom exercises only, `library` = built-ins only. */
  source: z.enum(['all', 'mine', 'library']).default('all'),
  sort: z.enum(['relevance', 'name', 'popularity', 'newest']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type ListExercisesQuery = z.infer<typeof listExercisesQuery>;

const trimmedLines = z.array(z.string().trim().min(1).max(600)).max(30).optional();

export const createCustomExerciseSchema = z.object({
  name: z.string().trim().min(2, 'Give the exercise a name.').max(120),
  description: z.string().trim().max(2000).nullish(),
  primaryMuscleId: z.string().min(1, 'Pick the primary muscle.'),
  secondaryMuscleIds: z.array(z.string().min(1)).max(8).optional(),
  equipmentId: z.string().min(1).nullish(),
  categoryId: z.string().min(1).nullish(),
  difficulty: z.enum(Difficulty).default(Difficulty.INTERMEDIATE),
  mechanic: z.enum(Mechanic).default(Mechanic.UNKNOWN),
  movementType: z.enum(MovementType).default(MovementType.OTHER),
  trackingType: z.enum(TrackingType).default(TrackingType.WEIGHT_REPS),
  isUnilateral: z.boolean().default(false),
  defaultRestSeconds: z.coerce.number().int().min(0).max(1800).default(90),
  instructions: trimmedLines,
  commonMistakes: trimmedLines,
  tips: trimmedLines,
  breathing: z.string().trim().max(600).nullish(),
  aliases: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  thumbnailUrl: z.string().url().max(600).nullish(),
  mediaUrl: z.string().url().max(600).nullish(),
  mediaType: z.enum(MediaType).default(MediaType.NONE),
});

export const updateCustomExerciseSchema = createCustomExerciseSchema.partial();

/** Admin-only fields on top of the custom-exercise shape. */
export const adminExerciseSchema = createCustomExerciseSchema.extend({
  slug: z.string().trim().min(2).max(90).optional(),
  status: z.enum(PublishStatus).default(PublishStatus.PUBLISHED),
  mediaAttribution: z.string().trim().max(300).nullish(),
  mediaAssetId: z.string().min(1).nullish(),
  popularity: z.coerce.number().int().min(0).optional(),
});

export const adminExerciseUpdateSchema = adminExerciseSchema.partial();

export const exerciseNoteSchema = z.object({
  body: z.string().trim().max(2000),
});
