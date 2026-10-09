import { MediaType } from '../../generated/prisma/enums.js';
import { iso } from '../../lib/serialize.js';

const muscleSelect = { id: true, slug: true, name: true, colorHex: true, bodyRegion: true } as const;

/** Shared `select` for list views - deliberately excludes long-form content. */
export const exerciseCardSelect = {
  id: true,
  slug: true,
  name: true,
  difficulty: true,
  mechanic: true,
  movementType: true,
  trackingType: true,
  isUnilateral: true,
  defaultRestSeconds: true,
  thumbnailUrl: true,
  mediaUrl: true,
  mediaType: true,
  mediaAttribution: true,
  frameUrls: true,
  isCustom: true,
  popularity: true,
  primaryMuscle: { select: muscleSelect },
  equipment: { select: { id: true, slug: true, name: true, iconKey: true } },
  category: { select: { id: true, slug: true, name: true } },
} as const;

/** Full detail view: instructions, mistakes, breathing, secondary muscles. */
export const exerciseDetailSelect = {
  ...exerciseCardSelect,
  description: true,
  instructions: true,
  commonMistakes: true,
  tips: true,
  breathing: true,
  aliases: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  secondaryMuscles: { select: { muscleGroup: { select: muscleSelect } } },
} as const;

type Card = {
  secondaryMuscles?: Array<{ muscleGroup: unknown }>;
  createdAt?: Date;
  updatedAt?: Date;
  mediaType?: MediaType;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  frameUrls?: string[];
};

/**
 * Normalises media into one predictable shape so the client renders a card
 * without branching on data quality:
 *
 *   - `frames` (2+)  -> silent cross-fade loop of the movement's key positions
 *   - `loopUrl`      -> real video/GIF, autoplaying muted inline
 *   - `posterUrl`    -> single still
 *   - nothing        -> illustrated placeholder
 *
 * A poster is always provided when any image exists, so the first paint is
 * instant and the loop can be lazily upgraded once visible.
 */
export function serializeExercise<T extends Card>(exercise: T) {
  const { secondaryMuscles, createdAt, updatedAt, ...rest } = exercise;
  const mediaType = exercise.mediaType ?? MediaType.NONE;
  const isClip = mediaType === MediaType.GIF || mediaType === MediaType.VIDEO;
  const frames = exercise.frameUrls ?? [];
  const posterUrl = exercise.thumbnailUrl ?? frames[0] ?? (isClip ? null : exercise.mediaUrl ?? null);

  return {
    ...rest,
    ...(secondaryMuscles ? { secondaryMuscles: secondaryMuscles.map((s) => s.muscleGroup) } : {}),
    media: {
      type: mediaType,
      posterUrl,
      loopUrl: isClip ? exercise.mediaUrl ?? null : null,
      frames,
      isVideo: mediaType === MediaType.VIDEO,
      canAnimate: frames.length > 1 || isClip,
      hasMedia: Boolean(posterUrl) || isClip,
    },
    ...(createdAt ? { createdAt: iso(createdAt) } : {}),
    ...(updatedAt ? { updatedAt: iso(updatedAt) } : {}),
  };
}
