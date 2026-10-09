import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { qk } from '@/lib/queryClient';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

/**
 * "Missed a day" recovery: the date's workout moves to the next day and the
 * rest of the week slides along. Two scopes - just this week, or keep the
 * offset as the new ongoing rhythm.
 */
export function ShiftForwardDialog({
  date,
  open,
  onClose,
}: {
  /** ISO date whose workout should move to the next day. */
  date: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<'week' | 'ongoing'>('week');

  const shift = useMutation({
    mutationFn: (ongoing: boolean) => api.post('/schedule/shift', { from: date, ongoing }),
    onSuccess: (_data, ongoing) => {
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
      void queryClient.invalidateQueries({ queryKey: qk.dashboard });
      toast.success(
        ongoing
          ? 'Rhythm shifted - every day now does what the day before had planned, until you change it back.'
          : 'Week shifted - this workout moved to the next day and the rest followed.',
      );
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Shift the week forward?"
      description={`${formatDate(date, 'EEEE')}'s workout moves to the next day, and every remaining day this week slides along by one.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={shift.isPending}>
            Cancel
          </Button>
          <Button onClick={() => shift.mutate(scope === 'ongoing')} isLoading={shift.isPending} data-autofocus>
            Shift forward
          </Button>
        </>
      }
    >
      <div className="space-y-2" role="radiogroup" aria-label="How long should the shift last">
        {(
          [
            ['week', 'This week only', 'New week starts fresh on your normal plan.'],
            ['ongoing', 'Keep the new rhythm', 'The whole rotation stays one day later - next week too, until you change the plan start date.'],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={scope === value}
            onClick={() => setScope(value)}
            className={cn(
              'w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 text-left transition-colors',
              scope === value ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong',
            )}
          >
            <p className={cn('text-sm font-medium', scope === value ? 'text-accent' : 'text-text')}>{label}</p>
            <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
