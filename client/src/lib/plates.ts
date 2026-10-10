/**
 * "What do I put on the bar?" - answered without arithmetic between sets.
 *
 * Everything here works in the user's DISPLAY unit, because plates are
 * physical objects stamped in kg or lb; converting them would be nonsense.
 */

import type { Unit } from './units';

/** Pairs available in a normal commercial gym, heaviest first. */
export const PLATE_SIZES: Record<Unit, number[]> = {
  KG: [25, 20, 15, 10, 5, 2.5, 1.25],
  LB: [45, 35, 25, 10, 5, 2.5],
};

/** Common bars. `0` covers machines, dumbbells and cable work. */
export const BAR_OPTIONS: Record<Unit, number[]> = {
  KG: [20, 15, 10, 7, 0],
  LB: [45, 35, 25, 15, 0],
};

export const defaultBar = (unit: Unit) => (unit === 'LB' ? 45 : 20);

export type PlateLoad = {
  /** Per side, heaviest first - the order you actually load them. */
  perSide: Array<{ plate: number; count: number }>;
  /** Total the plates plus bar actually come to. */
  achieved: number;
  /** Target minus achieved. Non-zero means the target is not loadable. */
  remainder: number;
  /** True when the bar alone already exceeds the target. */
  belowBar: boolean;
};

/**
 * Greedy is exact for standard plate sets (every size divides into the next),
 * and it matches how a human loads a bar: biggest plates first.
 */
export function computePlates(target: number, bar: number, unit: Unit): PlateLoad {
  const sizes = PLATE_SIZES[unit];
  if (!Number.isFinite(target) || target <= 0) {
    return { perSide: [], achieved: bar, remainder: 0, belowBar: false };
  }
  if (target < bar) {
    return { perSide: [], achieved: bar, remainder: 0, belowBar: true };
  }

  // Plates go on in pairs, so work with one side and double it at the end.
  let perSideRemaining = (target - bar) / 2;
  const perSide: Array<{ plate: number; count: number }> = [];

  for (const plate of sizes) {
    const count = Math.floor((perSideRemaining + 1e-9) / plate);
    if (count > 0) {
      perSide.push({ plate, count });
      perSideRemaining -= count * plate;
    }
  }

  const loadedPerSide = perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
  const achieved = bar + loadedPerSide * 2;

  return {
    perSide,
    achieved: Math.round(achieved * 100) / 100,
    remainder: Math.round((target - achieved) * 100) / 100,
    belowBar: false,
  };
}

/** Remembering the user's bar across sessions is the whole point. */
const BAR_STORAGE_KEY = 'forge:plate-bar';

export function loadBarPreference(unit: Unit): number {
  if (typeof localStorage === 'undefined') return defaultBar(unit);
  const stored = localStorage.getItem(`${BAR_STORAGE_KEY}:${unit}`);
  const value = stored == null ? NaN : Number(stored);
  return BAR_OPTIONS[unit].includes(value) ? value : defaultBar(unit);
}

export function saveBarPreference(unit: Unit, bar: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`${BAR_STORAGE_KEY}:${unit}`, String(bar));
}
