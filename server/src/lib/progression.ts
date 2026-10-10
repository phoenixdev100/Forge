import { SetType, TrackingType } from '../generated/prisma/enums.js';
import { countsTowardVolume, tracksReps, tracksWeight } from './strength.js';
import { round } from './units.js';

/**
 * Double progression, stated plainly: work up the rep range at a fixed weight,
 * and when the top of the range is clean across every working set, add load and
 * start again at the bottom.
 *
 * The hint is advice, never a rule - nothing here writes to a plan or a set.
 * Only structured numbers are returned so the client can phrase it in the
 * user's own unit.
 */
export type ProgressionHint = {
  kind: 'ADD_WEIGHT' | 'ADD_REPS' | 'REPEAT' | 'BASELINE';
  /** What they did last time, for an honest "from -> to". */
  fromWeightKg: number | null;
  fromReps: number | null;
  /** The suggestion. Null where it does not apply (e.g. bodyweight work). */
  suggestedWeightKg: number | null;
  suggestedReps: number | null;
  /** The rep range this judgement was made against, if the plan set one. */
  targetRepsMin: number | null;
  targetRepsMax: number | null;
};

/**
 * The smallest honest jump. Microplates are rare, so 2.5 kg is the default
 * barbell step; light loads (dumbbell curls, cable work) move in 1.25 kg.
 */
function weightStepKg(weightKg: number): number {
  if (weightKg < 10) return 1;
  if (weightKg < 25) return 1.25;
  return 2.5;
}

type PreviousSet = {
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
};

export function suggestProgression(input: {
  trackingType: TrackingType;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  previousSets: PreviousSet[] | null;
}): ProgressionHint | null {
  const { trackingType, targetRepsMin, targetRepsMax } = input;

  // Progression on time and distance work is a different conversation; only
  // rep-based training gets a hint.
  if (!tracksReps(trackingType)) return null;

  const working = (input.previousSets ?? []).filter(
    (s) => countsTowardVolume(s.setType) && s.reps != null && s.reps > 0,
  );

  if (!working.length) {
    return {
      kind: 'BASELINE',
      fromWeightKg: null,
      fromReps: null,
      suggestedWeightKg: null,
      suggestedReps: targetRepsMin ?? null,
      targetRepsMin,
      targetRepsMax,
    };
  }

  const weighted = tracksWeight(trackingType);
  const topWeight = weighted
    ? working.reduce((max, s) => Math.max(max, s.weightKg ?? 0), 0)
    : 0;
  // Judge the sets that were performed at the working weight, not the ramp-up.
  const atTopWeight = weighted ? working.filter((s) => (s.weightKg ?? 0) >= topWeight) : working;
  const lowestReps = Math.min(...atTopWeight.map((s) => s.reps as number));
  const fromWeightKg = weighted && topWeight > 0 ? round(topWeight, 2) : null;

  const base = {
    fromWeightKg,
    fromReps: lowestReps,
    targetRepsMin,
    targetRepsMax,
  };

  // No rep range to chase: fall back to "beat the reps you just did".
  if (targetRepsMax == null) {
    return { ...base, kind: 'ADD_REPS', suggestedWeightKg: fromWeightKg, suggestedReps: lowestReps + 1 };
  }

  // Every working set at the top of the range - time to add load.
  if (lowestReps >= targetRepsMax) {
    if (!weighted || fromWeightKg == null) {
      return { ...base, kind: 'ADD_REPS', suggestedWeightKg: null, suggestedReps: lowestReps + 1 };
    }
    return {
      ...base,
      kind: 'ADD_WEIGHT',
      suggestedWeightKg: round(fromWeightKg + weightStepKg(fromWeightKg), 2),
      suggestedReps: targetRepsMin ?? targetRepsMax,
    };
  }

  // Below the bottom of the range: hold the weight and earn the reps first.
  if (targetRepsMin != null && lowestReps < targetRepsMin) {
    return { ...base, kind: 'REPEAT', suggestedWeightKg: fromWeightKg, suggestedReps: targetRepsMin };
  }

  // Inside the range: same weight, one more rep.
  return {
    ...base,
    kind: 'ADD_REPS',
    suggestedWeightKg: fromWeightKg,
    suggestedReps: Math.min(lowestReps + 1, targetRepsMax),
  };
}
