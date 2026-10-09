import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The single most-used control in the app: it is what you tap, with chalky
 * hands, between sets.
 *
 * Design constraints that drove it:
 *   - 44px+ touch targets, because this is used standing in a gym
 *   - you can still type an exact value instead of tapping 12 times
 *   - press-and-hold repeats, for jumping from 20 to 60
 *   - it never fights your typing: edits are committed on blur/Enter
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  label,
  suffix,
  placeholder = '-',
  size = 'md',
  allowDecimals = false,
  disabled,
  className,
  inputClassName,
  'aria-label': ariaLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  label?: string;
  suffix?: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  allowDecimals?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  'aria-label'?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const holdTimer = useRef<number | null>(null);
  const repeatTimer = useRef<number | null>(null);

  // Clear any pending repeat if the component unmounts mid-hold.
  useEffect(
    () => () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      if (repeatTimer.current) window.clearInterval(repeatTimer.current);
    },
    [],
  );

  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const round = (next: number) => Math.round(next * 1000) / 1000;

  const nudge = (direction: 1 | -1) => {
    if (disabled) return;
    const base = value ?? 0;
    onChange(round(clamp(base + direction * step)));
  };

  const startHold = (direction: 1 | -1) => {
    nudge(direction);
    holdTimer.current = window.setTimeout(() => {
      repeatTimer.current = window.setInterval(() => nudge(direction), 80);
    }, 420);
  };

  const stopHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (repeatTimer.current) window.clearInterval(repeatTimer.current);
    holdTimer.current = null;
    repeatTimer.current = null;
  };

  const commitDraft = () => {
    if (draft === null) return;
    const trimmed = draft.trim().replace(',', '.');
    if (trimmed === '') {
      onChange(null);
    } else {
      const parsed = allowDecimals ? Number.parseFloat(trimmed) : Number.parseInt(trimmed, 10);
      if (Number.isFinite(parsed)) onChange(round(clamp(parsed)));
    }
    setDraft(null);
  };

  const heights = { sm: 'h-9', md: 'h-11', lg: 'h-14' } as const;
  const buttonSizes = { sm: 'w-9', md: 'w-11', lg: 'w-12' } as const;
  const textSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl font-semibold' } as const;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label ? (
        <span className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">{label}</span>
      ) : null}
      <div
        className={cn(
          'flex items-stretch overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface-inset',
          heights[size],
          disabled && 'opacity-60',
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (value ?? 0) <= min}
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          aria-label={`Decrease ${ariaLabel ?? label ?? 'value'}`}
          className={cn(
            'flex shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text active:bg-border disabled:opacity-30',
            buttonSizes[size],
          )}
        >
          <Minus className="size-4" aria-hidden />
        </button>

        <input
          type="text"
          inputMode={allowDecimals ? 'decimal' : 'numeric'}
          // A numeric keypad on mobile, but still freely typeable.
          enterKeyHint="done"
          disabled={disabled}
          value={draft ?? (value === null ? '' : String(value))}
          placeholder={placeholder}
          aria-label={ariaLabel ?? label}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
              event.currentTarget.blur();
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              nudge(1);
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              nudge(-1);
            }
          }}
          className={cn(
            'tnum min-w-0 flex-1 border-x border-border bg-transparent text-center text-text outline-none placeholder:text-text-subtle',
            textSizes[size],
            inputClassName,
          )}
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (value ?? 0) >= max}
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          aria-label={`Increase ${ariaLabel ?? label ?? 'value'}`}
          className={cn(
            'flex shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text active:bg-border disabled:opacity-30',
            buttonSizes[size],
          )}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      {suffix ? <span className="text-[11px] text-text-subtle">{suffix}</span> : null}
    </div>
  );
}
