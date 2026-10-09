import { SetType, TrackingType } from '../generated/prisma/enums.js';
import { round } from './units.js';

/** Warmups are real work but shouldn't inflate volume or trigger PRs. */
export const countsTowardVolume = (setType: SetType) => setType !== SetType.WARMUP;

export const tracksWeight = (t: TrackingType) =>
  t === TrackingType.WEIGHT_REPS ||
  t === TrackingType.WEIGHTED_BODYWEIGHT ||
  t === TrackingType.WEIGHTED_TIME;

export const tracksReps = (t: TrackingType) =>
  t === TrackingType.WEIGHT_REPS ||
  t === TrackingType.BODYWEIGHT_REPS ||
  t === TrackingType.WEIGHTED_BODYWEIGHT ||
  t === TrackingType.REPS_ONLY ||
  t === TrackingType.AMRAP;

export const tracksTime = (t: TrackingType) =>
  t === TrackingType.TIME || t === TrackingType.WEIGHTED_TIME || t === TrackingType.DISTANCE_TIME;

export const tracksDistance = (t: TrackingType) => t === TrackingType.DISTANCE_TIME;

/**
 * Epley formula. Accurate enough in the 1-12 rep range that matters for
 * tracking progression, and the de facto standard in training apps.
 */
export function estimateOneRm(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return round(weightKg, 2);
  // Beyond ~15 reps the estimate stops being meaningful.
  if (reps > 15) return null;
  return round(weightKg * (1 + reps / 30), 2);
}

export type SetMetrics = { weightKg: number | null; reps: number | null; setType: SetType };

/**
 * Derived values are computed once at write time and stored on the row, so
 * progress charts never have to recompute across thousands of sets.
 */
export function deriveSetMetrics({ weightKg, reps, setType }: SetMetrics) {
  const include = countsTowardVolume(setType);
  const volumeKg = include && weightKg != null && reps != null ? round(weightKg * reps, 3) : null;
  const estimatedOneRmKg =
    include && weightKg != null && reps != null ? estimateOneRm(weightKg, reps) : null;
  return { volumeKg, estimatedOneRmKg };
}
