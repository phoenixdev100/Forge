/**
 * Estimated one-rep-max and the percentage table people actually load from.
 *
 * Epley is used (same as the server's e1RM on sets) so the calculator agrees
 * with the numbers already shown in history.
 */

export const E1RM_PERCENTAGES = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6] as const;

/** weight x (1 + reps/30) - matches the server's stored e1RM exactly. */
export function estimateOneRm(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) return null;
  if (reps === 1) return weight;
  // Beyond ~15 reps the estimate stops being meaningful.
  if (reps > 15) return null;
  return weight * (1 + reps / 30);
}

export type PercentRow = { pct: number; weight: number };

/**
 * Percentage table snapped to the smallest loadable step, so 87.5% comes out
 * as a weight you can actually put on the bar.
 */
export function percentageTable(oneRm: number, snapStep: number): PercentRow[] {
  return E1RM_PERCENTAGES.map((pct) => ({
    pct,
    weight: Math.round((oneRm * pct) / snapStep) * snapStep,
  }));
}
