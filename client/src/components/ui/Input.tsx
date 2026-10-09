import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type OptionHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const FIELD =
  'w-full rounded-[var(--radius-control)] border border-border bg-surface-inset px-3 text-text ' +
  'placeholder:text-text-subtle transition-colors ' +
  'hover:border-border-strong focus:border-accent focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label id={`${id}-label`} htmlFor={id} className="block text-sm font-medium text-text">
          {label}
          {required ? (
            <span className="ml-1 text-danger" aria-hidden>
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  containerClassName?: string;
  inputSize?: 'md' | 'lg';
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, className, containerClassName, id, required, inputSize = 'md', ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <div className="relative">
        {leftIcon ? (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-subtle" aria-hidden>
            {leftIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(
            FIELD,
            inputSize === 'lg' ? 'h-12 text-base' : 'h-10 text-sm',
            leftIcon && 'pl-9',
            rightSlot && 'pr-10',
            error && 'border-danger',
            className,
          )}
          {...props}
        />
        {rightSlot ? <span className="absolute top-1/2 right-2 -translate-y-1/2">{rightSlot}</span> : null}
      </div>
    </FieldShell>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  containerClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, containerClassName, id, required, rows = 3, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} className={containerClassName}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(FIELD, 'resize-none py-2.5 text-sm leading-relaxed', error && 'border-danger', className)}
        {...props}
      />
    </FieldShell>
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  containerClassName?: string;
};

type SelectOption = { value: string; label: ReactNode; disabled: boolean };

/** Reads <option> children (and <optgroup> wrappers) into a flat list. */
function readOptions(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  const visit = (node: ReactNode) => {
    for (const child of Children.toArray(node)) {
      if (!isValidElement(child)) continue;
      if (child.type === 'optgroup') {
        visit((child.props as { children?: ReactNode }).children);
        continue;
      }
      const props = child.props as OptionHTMLAttributes<HTMLOptionElement>;
      out.push({
        value: String(props.value ?? props.children ?? ''),
        label: props.children,
        disabled: Boolean(props.disabled),
      });
    }
  };
  visit(children);
  return out;
}

const CHEVRON = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 shrink-0" aria-hidden>
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, containerClassName, id, required, children, onChange, disabled, name, value, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [flipUp, setFlipUp] = useState(false);
  const [listMaxH, setListMaxH] = useState(208);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const options = readOptions(children);
  const selectedIndex = options.findIndex((o) => o.value === String(value ?? ''));
  const shown = selectedIndex >= 0 ? options[selectedIndex] : options.find((o) => !o.disabled);

  // Close on outside interaction. Scrolling is fine - the list lives inside
  // the same scroll container as the trigger, so it moves along with it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const pick = (index: number) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    setOpen(false);
    if (opt.value === String(value ?? '')) return;
    // Call sites read e.target.value - provide a compatible synthetic event.
    onChange?.({ target: { value: opt.value, name }, currentTarget: { value: opt.value, name } } as never);
  };

  const openList = () => {
    if (disabled) return;
    const el = wrapRef.current;
    if (el) {
      // Measure space inside the nearest scrollable ancestor (dialog body)
      // too - opening downward into a footer looks broken.
      let containerTop = 0;
      let containerBottom = window.innerHeight;
      let parent = el.parentElement;
      while (parent) {
        const oy = getComputedStyle(parent).overflowY;
        if (oy === 'auto' || oy === 'scroll') {
          const r = parent.getBoundingClientRect();
          containerTop = r.top;
          containerBottom = r.bottom;
          break;
        }
        parent = parent.parentElement;
      }
      const rect = el.getBoundingClientRect();
      const below = Math.min(containerBottom, window.innerHeight) - rect.bottom;
      const above = rect.top - Math.max(containerTop, 0);
      const needed = Math.min(208, options.length * 34 + 10);
      const up = below < needed && above > below;
      setFlipUp(up);
      setListMaxH(Math.max(96, Math.min(needed, (up ? above : below) - 8)));
    }
    setHighlight(selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled));
    setOpen(true);
  };

  const move = (dir: 1 | -1) => {
    if (!options.length) return;
    let i = highlight;
    for (let step = 0; step < options.length; step++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    setHighlight(i);
    listRef.current?.children[i]?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        pick(highlight);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} className={containerClassName}>
      <div ref={wrapRef} className="relative">
        {/* Keeps native form semantics (name/value submission) + the ref API. */}
        <select
          ref={ref}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 -z-10 size-px opacity-0"
          {...props}
        >
          {children}
        </select>
        <button
          type="button"
          id={fieldId}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          aria-labelledby={label ? `${fieldId}-label` : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onKeyDown}
          className={cn(
            FIELD,
            'flex h-10 cursor-pointer items-center justify-between gap-2 pr-2.5 text-left text-sm',
            'focus:border-border-strong',
            open && (flipUp ? 'rounded-t-none' : 'rounded-b-none'),
            open && 'border-border-strong',
            error && 'border-danger',
            className,
          )}
        >
          <span className={cn('truncate', !shown && 'text-text-subtle')}>{shown?.label ?? ''}</span>
          <span className={cn('text-text-subtle transition-transform duration-150', open && 'rotate-180')}>{CHEVRON}</span>
        </button>
        {open ? (
          <ul
            ref={listRef}
            role="listbox"
            aria-activedescendant={highlight >= 0 ? `${fieldId}-opt-${highlight}` : undefined}
            style={{ maxHeight: listMaxH }}
            className={cn(
              'absolute inset-x-0 z-40 overflow-auto overscroll-contain border border-border-strong bg-surface-inset py-0.5 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.5)]',
              flipUp
                ? 'bottom-full -mb-px rounded-t-[var(--radius-control)] border-b-border'
                : 'top-full -mt-px rounded-b-[var(--radius-control)] border-t-border',
            )}
          >
            {options.map((opt, i) => {
              const isSel = i === selectedIndex;
              const isHi = i === highlight;
              return (
                <li
                  key={`${opt.value}-${i}`}
                  id={`${fieldId}-opt-${i}`}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={opt.disabled || undefined}
                  onPointerEnter={() => setHighlight(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm select-none',
                    isHi && !opt.disabled && 'bg-surface-raised',
                    isSel ? 'font-medium text-text' : 'text-text-muted',
                    opt.disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSel ? (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0" aria-hidden>
                      <path d="M3 8.5l3.5 3.5L13 4.5" />
                    </svg>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </FieldShell>
  );
});
