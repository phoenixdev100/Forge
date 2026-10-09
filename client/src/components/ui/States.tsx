import type { ReactNode } from 'react';
import { AlertCircle, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/** Shimmering placeholder. Always sized to the content it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-[var(--radius-control)]', className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-text-muted">
      <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = 'Loading', fullScreen }: { label?: string; fullScreen?: boolean }) {
  return (
    <div
      className={cn('flex items-center justify-center', fullScreen ? 'min-h-dvh' : 'min-h-[40vh]')}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <span className="text-sm">{label}…</span>
      </div>
    </div>
  );
}

/**
 * Every major section gets one of these instead of a blank screen, and each
 * points at the single next action that makes sense.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-surface/50 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-inset text-text-subtle">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-text-muted">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Error copy is written for a person, not a stack trace. The underlying
 * technical message is kept available for support but never shown by default.
 */
export function ErrorState({
  error,
  onRetry,
  title,
  className,
  compact,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
}) {
  const isOffline = error instanceof ApiError && error.code === 'NETWORK';
  const isDbDown = error instanceof ApiError && error.code === 'DATABASE_UNAVAILABLE';

  const heading =
    title ??
    (isOffline ? 'You appear to be offline' : isDbDown ? 'We cannot reach your data right now' : 'Something went wrong');

  const body = isOffline
    ? 'Check your connection. Your logged sets are safe - nothing was lost.'
    : error instanceof ApiError
      ? error.message
      : 'Please try again in a moment.';

  if (compact) {
    return (
      <div className={cn('flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger-soft px-3 py-2.5', className)}>
        <p className="text-sm text-danger">{body}</p>
        {onRetry ? (
          <Button variant="ghost" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="size-3.5" />}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        {isOffline ? <WifiOff className="size-5" aria-hidden /> : <AlertCircle className="size-5" aria-hidden />}
      </div>
      <h3 className="text-base font-semibold text-text">{heading}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-text-muted">{body}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry} leftIcon={<RefreshCw className="size-4" />}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
