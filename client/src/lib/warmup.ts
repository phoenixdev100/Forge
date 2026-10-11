/**
 * "What should I warm up with?" - the ramp between the empty bar and the
 * working weight, so nothing heavy is attempted cold.
 *
 * Percentages are the classic ramp; each suggestion is snapped to the nearest
 * loadable weight (plates exist in fixed sizes, so "63.4kg" is not advice).
 */

import type { Unit } from './units';
import { PLATE_SIZES, defaultBar } from './plates';

export type WarmupStep = {
  /** Fraction of the working weight this step represents. */
  pct: number;
  /** Loadable target after snapping, in the user's unit. */
  weight: number;
  reps: number;
};

/** Empty bar, then bigger jumps that get smaller as the weight climbs. */
const RAMP: Array<{ pct: number; reps: number }> = [
  { pct: 0.4, reps: 8 },
  { pct: 0.6, reps: 5 },
  { pct: 0.8, reps: 3 },
];

/** The smallest plate in the gym decides how precisely a weight can be made. */
function smallestPlate(unit: Unit): number {
  const sizes = PLATE_SIZES[unit];
  return sizes[sizes.length - 1] ?? 1;
}

/** Round to the nearest weight a pair of plates can actually make. */
function snapLoadable(weight: number, bar: number, unit: Unit): number {
  const step = smallestPlate(unit) * 2;
  const snapped = Math.round((weight - bar) / step) * step + bar;
  return Math.max(bar, Math.round(snapped * 100) / 100);
}

/**
 * The warm-up ladder for one working weight. Returns [] when the work is
 * light enough that the bar alone is the warm-up.
 */
export function warmupRamp(workingWeight: number, unit: Unit, bar?: number): WarmupStep[] {
  const barWeight = bar ?? defaultBar(unit);
  if (!Number.isFinite(workingWeight) || workingWeight <= barWeight) return [];

  const steps: WarmupStep[] = [];
  let last = barWeight;

  for (const { pct, reps } of RAMP) {
    const weight = snapLoadable(workingWeight * pct, barWeight, unit);
    // A step that lands on (or under) the previous one adds no value.
    if (weight > last + smallestPlate(unit)) {
      steps.push({ pct, weight, reps });
      last = weight;
    }
  }

  return steps;
}
