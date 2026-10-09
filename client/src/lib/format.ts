import { differenceInCalendarDays, format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

/** Parses a `YYYY-MM-DD` API date without timezone drift. */
export function parseDate(iso: string): Date {
  const date = parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return isValid(date) ? date : new Date(NaN);
}

export function formatDate(iso: string | null | undefined, pattern = 'd MMM yyyy'): string {
  if (!iso) return '-';
  const date = parseDate(iso);
  return isValid(date) ? format(date, pattern) : '-';
}

export const formatWeekday = (iso: string) => formatDate(iso, 'EEEE');
export const formatShortDate = (iso: string) => formatDate(iso, 'd MMM');

/** Local-day key for grouping timestamps - "2026-10-08". */
export const dayKey = (iso: string): string => {
  const date = parseDate(iso);
  return isValid(date) ? format(date, 'yyyy-MM-dd') : iso.slice(0, 10);
};

/** "Today" / "Yesterday" / "Tuesday" / "12 Mar" - what history lists want. */
export function formatRelativeDay(iso: string): string {
  const date = parseDate(iso);
  if (!isValid(date)) return '-';
  const diff = differenceInCalendarDays(date, new Date());
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return format(date, 'EEEE');
  if (diff < -1 && diff > -7) return `${format(date, 'EEEE')}`;
  return format(date, 'd MMM yyyy');
}

export function formatTimeAgo(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '-';
  const date = parseISO(isoTimestamp);
  return isValid(date) ? `${formatDistanceToNowStrict(date)} ago` : '-';
}

/** `58 min`, `1h 12m`, `45s` - compact and unambiguous. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** `1:30` for the rest timer. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}

/** `8-10`, `10`, or `-`. Rep targets are ranges more often than not. */
export function formatRepRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return '-';
  if (min != null && max != null) return min === max ? `${min}` : `${min}-${max}`;
  return `${min ?? max}`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** Turns `WEIGHT_REPS` into `Weight & reps` for labels and selects. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '-';
  const words = value.toLowerCase().split('_');
  const joined = words.join(' ').replace(/\breps\b/, 'reps');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

export const PR_TYPE_LABELS: Record<string, string> = {
  MAX_WEIGHT: 'Heaviest weight',
  MAX_REPS: 'Most reps',
  MAX_SET_VOLUME: 'Best set volume',
  MAX_SESSION_VOLUME: 'Best session volume',
  EST_ONE_RM: 'Estimated 1RM',
  BEST_TIME: 'Longest hold',
  BEST_DISTANCE: 'Furthest distance',
};

/**
 * Record types that are numbers the user physically entered - a weight on
 * the bar, a rep count, a hold time, a distance. Derived metrics (set and
 * session volume, estimated 1RM) never appear as records.
 */
const LIFT_RECORD_TYPES = new Set(['MAX_WEIGHT', 'MAX_REPS', 'BEST_TIME', 'BEST_DISTANCE']);
export const isLiftRecord = (r: { type: string }) => LIFT_RECORD_TYPES.has(r.type);

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
