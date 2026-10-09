import { UnitSystem } from '../generated/prisma/enums.js';

export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;

/**
 * Everything is persisted in kilograms. Conversion happens at the API edge so
 * a user switching KG <-> LB never rewrites their history.
 */
export const toKg = (value: number, unit: UnitSystem) =>
  unit === UnitSystem.LB ? round(value * KG_PER_LB, 3) : round(value, 3);

export const fromKg = (kg: number, unit: UnitSystem) =>
  unit === UnitSystem.LB ? round(kg / KG_PER_LB, 2) : round(kg, 2);

export const toCm = (value: number, unit: UnitSystem) =>
  unit === UnitSystem.LB ? round(value * CM_PER_INCH, 1) : round(value, 1);

export const fromCm = (cm: number, unit: UnitSystem) =>
  unit === UnitSystem.LB ? round(cm / CM_PER_INCH, 1) : round(cm, 1);

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Snap to the smallest plate increment the user can realistically load. */
export const plateIncrement = (unit: UnitSystem) => (unit === UnitSystem.LB ? 2.5 : 1.25);

export const unitLabel = (unit: UnitSystem) => (unit === UnitSystem.LB ? 'lb' : 'kg');
