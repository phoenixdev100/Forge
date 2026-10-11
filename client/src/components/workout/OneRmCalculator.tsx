import { useMemo, useState } from 'react';
import { plateStep, trimNumber, unitLabel, type Unit } from '@/lib/units';
import { estimateOneRm, percentageTable } from '@/lib/oneRepMax';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Stepper } from '@/components/ui/Stepper';

/**
 * Heavy-day planning: enter a set (weight x reps), get an estimated one-rep
 * max plus the percentage table a coach would programme from. Read-only - it
 * never writes to a set or a record.
 */
export function OneRmCalculator({
  open,
  onClose,
  unit,
  initialWeight,
  initialReps,
}: {
  open: boolean;
  onClose: () => void;
  unit: Unit;
  /** Both in display units / plain reps, prefilled from context when known. */
  initialWeight?: number | null;
  initialReps?: number | null;
}) {
  const [weight, setWeight] = useState<number | null>(initialWeight ?? null);
  const [reps, setReps] = useState<number | null>(initialReps ?? null);

  const oneRm = useMemo(
    () => (weight != null && reps != null ? estimateOneRm(weight, reps) : null),
    [weight, reps],
  );
  const step = plateStep(unit) * 2;
  const table = useMemo(() => (oneRm != null ? percentageTable(oneRm, step) : []), [oneRm, step]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="1RM calculator"
      description="Epley estimate - the same number shown on your logged sets."
      footer={<Button size="sm" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stepper
            label={`Weight (${unitLabel(unit)})`}
            value={weight}
            onChange={setWeight}
            step={plateStep(unit)}
            min={0}
            max={999}
            allowDecimals
          />
          <Stepper label="Reps" value={reps} onChange={setReps} step={1} min={1} max={15} />
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface-inset p-3 text-center">
          {oneRm != null ? (
            <>
              <p className="text-[11px] font-semibold tracking-wide text-text-subtle uppercase">
                Estimated 1RM
              </p>
              <p className="tnum mt-1 text-3xl font-bold text-accent">
                {trimNumber(oneRm, 1)} <span className="text-base font-medium">{unitLabel(unit)}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              {reps != null && reps > 15
                ? 'Over 15 reps the estimate gets too noisy to trust.'
                : 'Enter a weight and reps to see the estimate.'}
            </p>
          )}
        </div>

        {table.length ? (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-inset text-left text-[11px] font-semibold tracking-wide text-text-subtle uppercase">
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2 text-right">Load</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.pct} className="border-b border-border last:border-0">
                    <td className="tnum px-3 py-1.5 text-text-muted">{Math.round(row.pct * 100)}%</td>
                    <td className="tnum px-3 py-1.5 text-right font-medium text-text">
                      {trimNumber(row.weight)} {unitLabel(unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
