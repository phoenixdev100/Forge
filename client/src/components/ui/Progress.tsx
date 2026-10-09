import { cn } from '@/lib/cn';

export function ProgressBar({
  value,
  max = 100,
  className,
  tone = 'accent',
  size = 'md',
  label,
}: {
  value: number;
  max?: number;
  className?: string;
  tone?: 'accent' | 'success' | 'neutral';
  size?: 'sm' | 'md';
  label?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const tones = { accent: 'bg-accent', success: 'bg-success', neutral: 'bg-text-subtle' } as const;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-surface-inset', size === 'sm' ? 'h-1' : 'h-1.5', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-quint)]', tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Compact circular progress for the "4 of 6 exercises" dashboard card. */
export function ProgressRing({
  value,
  max,
  size = 44,
  strokeWidth = 4,
  children,
  className,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-surface-inset" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="stroke-accent transition-[stroke-dashoffset] duration-500 ease-[var(--ease-out-quint)]"
        />
      </svg>
      <span className="tnum absolute text-[11px] font-semibold text-text">{children}</span>
    </div>
  );
}
