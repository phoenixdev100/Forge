import type { SessionSet, TrackingType } from './types';
import { formatClock } from './format';
import { formatWeight, type Unit } from './units';

/**
 * Not every exercise is weight x reps. These helpers decide which inputs
 * workout mode renders, so a plank asks for seconds and a pull-up asks for
 * added weight - without a single hardcoded exercise name anywhere in the UI.
 */

export const tracksWeight = (t: TrackingType) =>
  t === 'WEIGHT_REPS' || t === 'WEIGHTED_BODYWEIGHT' || t === 'WEIGHTED_TIME';

export const tracksReps = (t: TrackingType) =>
  t === 'WEIGHT_REPS' || t === 'BODYWEIGHT_REPS' || t === 'WEIGHTED_BODYWEIGHT' || t === 'REPS_ONLY' || t === 'AMRAP';

export const tracksTime = (t: TrackingType) => t === 'TIME' || t === 'WEIGHTED_TIME' || t === 'DISTANCE_TIME';

export const tracksDistance = (t: TrackingType) => t === 'DISTANCE_TIME';

/** Added load on a bodyweight movement is optional, not required. */
export const weightIsOptional = (t: TrackingType) => t === 'WEIGHTED_BODYWEIGHT' || t === 'WEIGHTED_TIME';

export const weightFieldLabel = (t: TrackingType) =>
  t === 'WEIGHTED_BODYWEIGHT' || t === 'WEIGHTED_TIME' ? 'Added' : 'Weight';

/** A set counts as logged once its primary metric has a value. */
export function setHasValue(set: Pick<SessionSet, 'reps' | 'timeSeconds' | 'distanceM'>): boolean {
  return set.reps != null || set.timeSeconds != null || set.distanceM != null;
}

export const TRACKING_LABELS: Record<TrackingType, string> = {
  WEIGHT_REPS: 'Weight & reps',
  BODYWEIGHT_REPS: 'Bodyweight reps',
  WEIGHTED_BODYWEIGHT: 'Bodyweight + added weight',
  REPS_ONLY: 'Reps only',
  TIME: 'Time',
  WEIGHTED_TIME: 'Time + added weight',
  DISTANCE_TIME: 'Distance & time',
  AMRAP: 'AMRAP',
};

/** `62.5 kg x 8`, `45s`, `12 reps` - one set rendered for any tracking type. */
export function formatSet(
  set: Pick<SessionSet, 'weightKg' | 'reps' | 'timeSeconds' | 'distanceM'>,
  trackingType: TrackingType,
  unit: Unit,
): string {
  const parts: string[] = [];

  if (tracksWeight(trackingType) && set.weightKg != null && set.weightKg > 0) {
    parts.push(formatWeight(set.weightKg, unit));
  }
  if (tracksReps(trackingType) && set.reps != null) {
    parts.push(parts.length ? `× ${set.reps}` : `${set.reps} reps`);
  }
  if (tracksTime(trackingType) && set.timeSeconds != null) {
    parts.push(set.timeSeconds >= 60 ? formatClock(set.timeSeconds) : `${set.timeSeconds}s`);
  }
  if (tracksDistance(trackingType) && set.distanceM != null) {
    parts.push(set.distanceM >= 1000 ? `${(set.distanceM / 1000).toFixed(2)} km` : `${set.distanceM} m`);
  }

  // Bodyweight with no added load is still a real, loggable set.
  if (!parts.length && set.reps != null) parts.push(`${set.reps} reps`);

  return parts.join(' ') || '-';
}

export const SET_TYPE_LABELS: Record<string, string> = {
  NORMAL: 'Working',
  WARMUP: 'Warm-up',
  DROP: 'Drop set',
  FAILURE: 'To failure',
  AMRAP: 'AMRAP',
  BACKOFF: 'Back-off',
};

/** Short badge text; working sets get no badge at all to reduce noise. */
export const setTypeBadge = (setType: string): string | null =>
  setType === 'NORMAL' ? null : (SET_TYPE_LABELS[setType] ?? setType);
