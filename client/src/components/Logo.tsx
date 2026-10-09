import { cn } from '@/lib/cn';

/**
 * A barbell abstracted into a mark: two plates and a bar. Uses `currentColor`
 * for the bar so it inherits text colour, with the accent reserved for plates.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <rect x="6" y="14.5" width="20" height="3" rx="1.5" className="fill-accent-contrast" />
      <rect x="8.5" y="10" width="3.5" height="12" rx="1.75" className="fill-accent-contrast" />
      <rect x="20" y="10" width="3.5" height="12" rx="1.75" className="fill-accent-contrast" />
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Logo className="size-7" />
      <span className="text-base font-semibold tracking-tight">Forge</span>
    </span>
  );
}
