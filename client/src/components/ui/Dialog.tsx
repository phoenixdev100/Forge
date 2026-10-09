import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Small icon bubble rendered left of the title (e.g. warning for deletes). */
  titleIcon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** `sheet` slides up from the bottom - the right pattern on a phone. */
  variant?: 'modal' | 'sheet';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Hides the X and disables backdrop/Escape dismissal. */
  dismissible?: boolean;
};

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/**
 * Accessible dialog: focus is trapped while open, Escape and the backdrop
 * dismiss it, focus returns to whatever opened it, and background scroll is
 * locked. Rendered in a portal so it is never clipped by a transformed parent.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  titleIcon,
  children,
  footer,
  variant = 'modal',
  size = 'md',
  dismissible = true,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (!focusable.length) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [dismissible, onClose],
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown, true);

    // Focus the first control rather than the panel, so keyboard users land
    // somewhere useful immediately.
    const timer = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
        panelRef.current;
      target?.focus();
    }, 20);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  // Bottom sheets are a phone pattern - on desktop the same dialog renders
  // centered like a regular modal so it never hugs the screen edge.
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const isSheet = variant === 'sheet' && !isDesktop;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className={cn('fixed inset-0 z-50 flex', isSheet ? 'items-end' : 'items-center justify-center p-4')}>
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={dismissible ? onClose : undefined}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={isSheet ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 8 }}
            animate={isSheet ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isSheet ? { y: '100%' } : { opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden border border-border bg-surface shadow-[var(--shadow-overlay)]',
              isSheet
                ? 'max-h-[88vh] rounded-t-2xl pb-safe sm:mx-auto sm:max-w-lg sm:rounded-2xl sm:pb-0'
                : cn('rounded-[var(--radius-card)]', SIZES[size]),
            )}
          >
            {isSheet ? (
              <div className="flex justify-center pt-3 pb-1" aria-hidden>
                <span className="h-1 w-10 rounded-full bg-border-strong" />
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
              {titleIcon ? <span className="mt-0.5 shrink-0">{titleIcon}</span> : null}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-base font-semibold text-text">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm text-text-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              {dismissible ? (
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 shrink-0">
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>

            {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div> : null}

            {footer ? (
              <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/** Destructive actions always get an explicit confirmation step. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  isLoading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      titleIcon={
        tone === 'danger' ? (
          <span className="flex size-9 items-center justify-center rounded-full bg-danger-soft text-danger">
            <TriangleAlert className="size-4" aria-hidden />
          </span>
        ) : undefined
      }
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} size="sm" onClick={onConfirm} isLoading={isLoading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
