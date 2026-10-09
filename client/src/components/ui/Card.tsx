import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Surfaces are separated by a subtle border, not a drop shadow. Only genuinely
 * floating things (dialogs, drag previews) get elevation.
 */
export function Card({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-border bg-surface',
        interactive && 'transition-colors hover:border-border-strong hover:bg-surface-hover',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <div className="mt-0.5 text-text-subtle">{icon}</div> : null}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-text-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 border-t border-border px-5 py-4', className)} {...props} />;
}

/** The stat tile used across the dashboard and progress pages. */
export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  title,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'accent' | 'success';
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-[var(--radius-card)] border border-border bg-surface p-4', className)}
      title={title}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-text-subtle uppercase">{label}</span>
        {icon ? (
          <span className={cn('text-text-subtle', tone === 'accent' && 'text-accent', tone === 'success' && 'text-success')}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="tnum mt-2 text-2xl font-semibold text-text">{value}</div>
      {sub ? <div className="mt-1 text-xs text-text-muted">{sub}</div> : null}
    </div>
  );
}
