import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-inset text-text-muted border-transparent',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  outline: 'bg-transparent text-text-muted border-border',
};

export function Badge({
  tone = 'neutral',
  size = 'md',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; size?: 'sm' | 'md'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Muscle-group chip tinted with that group's own colour.
 *
 * Colour is never the only signal - the name is always shown - so this stays
 * readable for colour-blind users.
 */
export function MuscleBadge({
  name,
  colorHex,
  size = 'md',
  className,
}: {
  name: string;
  colorHex?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
      style={{
        color: colorHex,
        borderColor: colorHex ? `color-mix(in oklch, ${colorHex} 35%, transparent)` : undefined,
        backgroundColor: colorHex ? `color-mix(in oklch, ${colorHex} 12%, transparent)` : undefined,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: colorHex }} aria-hidden />
      {name}
    </span>
  );
}

const DIFFICULTY_TONE: Record<string, Tone> = {
  BEGINNER: 'success',
  INTERMEDIATE: 'info',
  ADVANCED: 'warning',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export function DifficultyBadge({ difficulty, size = 'sm' }: { difficulty: string; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={DIFFICULTY_TONE[difficulty] ?? 'neutral'} size={size}>
      {DIFFICULTY_LABEL[difficulty] ?? difficulty}
    </Badge>
  );
}
