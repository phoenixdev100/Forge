import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { tracksReps, tracksTime, tracksWeight } from '@/lib/tracking';
import type { ExerciseDetail, Plan } from '@/lib/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Input';
import { Stepper } from '@/components/ui/Stepper';
import { EmptyState, PageLoader } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { plateStep, toKg, unitLabel } from '@/lib/units';
import { useUnit } from '@/providers/AuthProvider';
import { ListChecks } from 'lucide-react';

/**
 * "Add to plan" from an exercise page: pick the plan, then the day inside it.
 * The exercise lands with sensible defaults that stay editable in the builder.
 */
export function AddToPlanDialog({ exercise, open, onClose }: { exercise: ExerciseDetail; open: boolean; onClose: () => void }) {
  const unit = useUnit();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [planId, setPlanId] = useState<string | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);
  const [sets, setSets] = useState<number | null>(3);
  const [repsMin, setRepsMin] = useState<number | null>(8);
  const [repsMax, setRepsMax] = useState<number | null>(12);
  const [weight, setWeight] = useState<number | null>(null);

  const { data: plans } = useQuery({
    queryKey: qk.plans,
    queryFn: () => api.get<{ plans: Array<{ id: string; name: string; isActive: boolean }> }>('/plans'),
    enabled: open,
  });

  const activePlanId = planId ?? plans?.plans.find((p) => p.isActive)?.id ?? plans?.plans[0]?.id ?? null;

  const { data: planData, isPending: planLoading } = useQuery({
    queryKey: qk.plan(activePlanId!),
    queryFn: () => api.get<{ plan: Plan }>(`/plans/${activePlanId}`),
    enabled: open && Boolean(activePlanId),
  });

  const workoutDays = (planData?.plan.days ?? []).filter((d) => d.dayType === 'WORKOUT');
  const tracking = exercise.trackingType;

  const add = useMutation({
    mutationFn: () =>
      api.post(`/plans/days/${dayId}/exercises`, {
        exerciseId: exercise.id,
        targetSets: sets,
        targetRepsMin: tracksReps(tracking) ? repsMin : null,
        targetRepsMax: tracksReps(tracking) ? repsMax : null,
        targetWeightKg: tracksWeight(tracking) && weight != null ? toKg(weight, unit) : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      const day = workoutDays.find((d) => d.id === dayId);
      toast.success(`Added to ${day?.displayLabel ?? 'your plan'}.`);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add "${exercise.name}" to a plan`}
      variant="sheet"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => add.mutate()} isLoading={add.isPending} disabled={!dayId}>
            Add to workout
          </Button>
        </>
      }
    >
      {!plans?.plans.length && !planLoading ? (
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="No plan yet"
          description="Create a plan first - then this exercise can live on one of its days."
          action={
            <Button onClick={() => { onClose(); navigate('/app/plans'); }}>Create a plan</Button>
          }
        />
      ) : planLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          <Select
            label="Plan"
            value={activePlanId ?? ''}
            onChange={(e) => {
              setPlanId(e.target.value);
              setDayId(null);
            }}
          >
            {plans!.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.isActive ? ' (active)' : ''}
              </option>
            ))}
          </Select>

          <div>
            <p className="mb-1.5 text-sm font-medium text-text">Workout day</p>
            <div className="grid grid-cols-2 gap-1.5">
              {workoutDays.map((day) => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setDayId(day.id)}
                  aria-pressed={dayId === day.id}
                  className={cn(
                    'rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors',
                    dayId === day.id ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong',
                  )}
                >
                  <span className="block text-[11px] font-medium tracking-wide text-text-subtle uppercase">{day.positionLabel}</span>
                  <span className={cn('block truncate text-sm font-medium', dayId === day.id ? 'text-accent' : 'text-text')}>
                    {day.displayLabel}
                  </span>
                </button>
              ))}
            </div>
            {!workoutDays.length ? (
              <p className="text-sm text-text-muted">This plan has no workout days yet - add one in the plan editor.</p>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-[var(--radius-card)] border border-border bg-surface-inset p-3">
            <Stepper label="Sets" size="sm" value={sets} onChange={setSets} min={1} max={50} />
            {tracksReps(tracking) ? (
              <>
                <Stepper label="Reps min" size="sm" value={repsMin} onChange={setRepsMin} min={0} max={500} />
                <Stepper label="Reps max" size="sm" value={repsMax} onChange={setRepsMax} min={0} max={500} />
              </>
            ) : null}
            {tracksWeight(tracking) ? (
              <Stepper
                label={`Weight (${unitLabel(unit)})`}
                size="sm"
                value={weight}
                onChange={setWeight}
                step={plateStep(unit)}
                min={0}
                max={1000}
                allowDecimals
              />
            ) : null}
            {tracksTime(tracking) ? (
              <p className="col-span-2 self-end pb-1 text-xs text-text-subtle">Time target configurable in the plan editor.</p>
            ) : null}
          </div>
        </div>
      )}
    </Dialog>
  );
}
