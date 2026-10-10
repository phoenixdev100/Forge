import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  BAR_OPTIONS,
  computePlates,
  loadBarPreference,
  saveBarPreference,
} from '@/lib/plates';
import { plateStep, trimNumber, unitLabel, type Unit } from '@/lib/units';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Stepper } from '@/components/ui/Stepper';

/** Wider plates read as heavier - the same visual language as a real rack. */
function plateWidth(plate: number, heaviest: number): string {
  const ratio = heaviest > 0 ? plate / heaviest : 1;
  return `${Math.round(38 + ratio * 52)}px`;
}

/**
 * The between-sets question, answered: for a target weight and a bar, what
 * goes on each side. Purely a calculator - it never writes to a set.
 */
export function PlateCalculator({
  open,
  onClose,
  unit,
  initialWeight,
  exerciseName,
}: {
  open: boolean;
  onClose: () => void;
  unit: Unit;
  /** In the user's display unit. Plates are physical, so no conversion here. */
  initialWeight: number | null;
  exerciseName?: string;
}) {
  const [bar, setBar] = useState(() => loadBarPreference(unit));
  const [target, setTarget] = useState<number | null>(initialWeight);

  const load = useMemo(() => computePlates(target ?? 0, bar, unit), [target, bar, unit]);
  const heaviest = load.perSide[0]?.plate ?? 1;
  const hasPlates = load.perSide.length > 0;

  const chooseBar = (value: number) => {
    setBar(value);
    saveBarPreference(unit, value);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Plate calculator"
      description={exerciseName ? `Loading for ${exerciseName}` : 'What goes on each side of the bar'}
      footer={<Button size="sm" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stepper
            label={`Target weight (${unitLabel(unit)})`}
            value={target}
            onChange={setTarget}
            step={plateStep(unit)}
            min={0}
            max={999}
            allowDecimals
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-text">Bar</p>
            <div className="flex flex-wrap gap-1.5">
              {BAR_OPTIONS[unit].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => chooseBar(option)}
                  aria-pressed={bar === option}
                  className={cn(
                    'tnum h-9 rounded-[var(--radius-control)] border px-2.5 text-xs font-medium transition-colors',
                    bar === option
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-surface text-text-muted hover:border-border-strong',
                  )}
                >
                  {option === 0 ? 'None' : `${option} ${unitLabel(unit)}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* The answer */}
        <div className="rounded-[var(--radius-card)] border border-border bg-surface-inset p-3">
          {load.belowBar ? (
            <p className="flex items-start gap-2 text-sm text-text-muted">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              The bar alone is {trimNumber(bar)} {unitLabel(unit)} - heavier than your target. Pick a lighter bar.
            </p>
          ) : !hasPlates ? (
            <p className="text-sm text-text-muted">
              {bar > 0 ? 'Empty bar - no plates needed.' : 'Enter a target weight to see the plates.'}
            </p>
          ) : (
            <>
              <p className="text-xs font-semibold tracking-wide text-text-subtle uppercase">Per side</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {load.perSide.flatMap(({ plate, count }) =>
                  Array.from({ length: count }, (_, index) => (
                    <span
                      key={`${plate}-${index}`}
                      style={{ width: plateWidth(plate, heaviest) }}
                      className="tnum flex h-10 items-center justify-center rounded-[6px] bg-accent text-xs font-bold text-accent-contrast"
                    >
                      {trimNumber(plate)}
                    </span>
                  )),
                )}
              </div>
              <p className="tnum mt-2.5 text-sm text-text">
                {load.perSide.map(({ plate, count }) => `${count} × ${trimNumber(plate)}`).join('  +  ')}
                <span className="text-text-subtle"> per side</span>
              </p>
            </>
          )}
        </div>

        <dl className="tnum grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[var(--radius-control)] bg-surface-inset px-2 py-2">
            <dt className="text-[11px] tracking-wide text-text-subtle uppercase">Bar</dt>
            <dd className="text-sm font-semibold text-text">{trimNumber(bar)}</dd>
          </div>
          <div className="rounded-[var(--radius-control)] bg-surface-inset px-2 py-2">
            <dt className="text-[11px] tracking-wide text-text-subtle uppercase">Loaded</dt>
            <dd className="text-sm font-semibold text-text">{trimNumber(load.achieved)}</dd>
          </div>
          <div
            className={cn(
              'rounded-[var(--radius-control)] px-2 py-2',
              load.remainder > 0 ? 'bg-warning-soft' : 'bg-surface-inset',
            )}
          >
            <dt className="text-[11px] tracking-wide text-text-subtle uppercase">Off by</dt>
            <dd className={cn('text-sm font-semibold', load.remainder > 0 ? 'text-warning' : 'text-text')}>
              {trimNumber(load.remainder)}
            </dd>
          </div>
        </dl>

        {load.remainder > 0 ? (
          <p className="text-xs text-text-subtle">
            {trimNumber(load.achieved)} {unitLabel(unit)} is the closest loadable weight below your target with
            standard plates.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
