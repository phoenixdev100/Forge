/**
 * All calendar dates are handled as UTC-midnight `Date` objects backed by
 * Postgres `date` columns. Doing the arithmetic in UTC keeps a workout logged
 * at 23:00 on a DST boundary on the day the user actually trained.
 */

export const MS_PER_DAY = 86_400_000;

/** `"2026-03-14"` -> Date(2026-03-14T00:00:00Z) */
export function parseIsoDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}

/** Date -> `"2026-03-14"` */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function diffInDays(a: Date, b: Date): number {
  return Math.round((startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime()) / MS_PER_DAY);
}

/**
 * "Today" in the user's timezone, as a UTC-midnight date. A user in Sydney
 * logging at 08:00 local must not get yesterday's workout.
 */
export function todayFor(timezone: string, now = new Date()): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    return parseIsoDate(parts);
  } catch {
    return startOfUtcDay(now);
  }
}

/** 0 = Sunday … 6 = Saturday */
export const weekdayOf = (date: Date) => date.getUTCDay();

export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const offset = (weekdayOf(date) - weekStartsOn + 7) % 7;
  return addDays(startOfUtcDay(date), -offset);
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let d = startOfUtcDay(from); d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * Maps a calendar date onto a position in a plan's cycle.
 *
 * For the common 7-day plan, position is simply the weekday offset from the
 * user's week start - so "Monday" always means Monday without an anchor date.
 * For custom cycles (5-day, 10-day rotations) the plan's `startsOn` anchors
 * the rotation and positions advance continuously from there.
 */
export function cyclePositionFor(
  date: Date,
  plan: { cycleLength: number; startsOn: Date | null },
  weekStartsOn = 1,
): number {
  const length = Math.max(1, plan.cycleLength);
  if (length === 7 && !plan.startsOn) {
    return (weekdayOf(date) - weekStartsOn + 7) % 7;
  }
  const anchor = plan.startsOn ? startOfUtcDay(plan.startsOn) : startOfWeek(date, weekStartsOn);
  const delta = diffInDays(date, anchor);
  return ((delta % length) + length) % length;
}

/** Inverse of `cyclePositionFor`: the next date on or after `from` for a position. */
export function nextDateForPosition(
  position: number,
  from: Date,
  plan: { cycleLength: number; startsOn: Date | null },
  weekStartsOn = 1,
): Date {
  const length = Math.max(1, plan.cycleLength);
  const current = cyclePositionFor(from, plan, weekStartsOn);
  const delta = ((position - current) % length + length) % length;
  return addDays(startOfUtcDay(from), delta);
}

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Human label for a cycle position, e.g. position 0 with Monday start -> "Monday". */
export function positionLabel(position: number, cycleLength: number, weekStartsOn = 1): string {
  if (cycleLength === 7) return WEEKDAY_LABELS[(position + weekStartsOn) % 7] as string;
  return `Day ${position + 1}`;
}
