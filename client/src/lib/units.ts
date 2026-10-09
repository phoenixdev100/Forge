/**
 * The ONE place weight conversion happens.
 *
 * The API and database only ever speak kilograms. Everything the user sees or
 * types goes through here, which is what makes "switch to lb" a pure display
 * change that cannot corrupt a single historical set.
 */

export type Unit = 'KG' | 'LB';

export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;

/** Display value (in the user's unit) -> canonical kilograms for the API. */
export function toKg(value: number, unit: Unit): number {
  const kg = unit === 'LB' ? value * KG_PER_LB : value;
  return Math.round(kg * 1000) / 1000;
}

/** Canonical kilograms from the API -> display value in the user's unit. */
export function fromKg(kg: number, unit: Unit): number {
  const value = unit === 'LB' ? kg / KG_PER_LB : kg;
  return Math.round(value * 100) / 100;
}

export function toCm(value: number, unit: Unit): number {
  return Math.round((unit === 'LB' ? value * CM_PER_INCH : value) * 10) / 10;
}

export function fromCm(cm: number, unit: Unit): number {
  return Math.round((unit === 'LB' ? cm / CM_PER_INCH : cm) * 10) / 10;
}

export const unitLabel = (unit: Unit) => (unit === 'LB' ? 'lb' : 'kg');
export const lengthLabel = (unit: Unit) => (unit === 'LB' ? 'in' : 'cm');

/** Smallest increment the user can actually load on a bar. */
export const plateStep = (unit: Unit) => (unit === 'LB' ? 2.5 : 1.25);

/** Trims pointless trailing zeros: 62.5 stays, 60.00 becomes 60. */
export function trimNumber(value: number, maxDecimals = 2): string {
  return Number(value.toFixed(maxDecimals)).toString();
}

/** `62.5 kg` - the canonical way weight is rendered across the app. */
export function formatWeight(kg: number | null | undefined, unit: Unit, options: { withUnit?: boolean } = {}): string {
  if (kg === null || kg === undefined) return '-';
  const value = trimNumber(fromKg(kg, unit));
  return options.withUnit === false ? value : `${value} ${unitLabel(unit)}`;
}

/** Large totals read better rounded and grouped: `4,820 kg`. */
export function formatVolume(kg: number | null | undefined, unit: Unit): string {
  if (kg === null || kg === undefined) return '-';
  const value = fromKg(kg, unit);
  if (value >= 1000) return `${Math.round(value).toLocaleString()} ${unitLabel(unit)}`;
  return `${trimNumber(value, 1)} ${unitLabel(unit)}`;
}

/** Snaps a typed value to a loadable increment without fighting the user. */
export function snapToStep(value: number, unit: Unit): number {
  const step = plateStep(unit);
  return Math.max(0, Math.round(value / step) * step);
}
