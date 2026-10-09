import { Prisma } from '../db/prisma.js';

export type Decimalish = Prisma.Decimal | number | string | null | undefined;

/**
 * Prisma returns `Decimal` instances, which JSON.stringify turns into objects.
 * Every API response funnels numeric columns through this so the client always
 * receives plain numbers.
 */
export function num(value: Decimalish): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return value.toNumber();
}

export function numOr(value: Decimalish, fallback: number): number {
  return num(value) ?? fallback;
}

/** Postgres `date` column -> `"YYYY-MM-DD"`. */
export function dateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
