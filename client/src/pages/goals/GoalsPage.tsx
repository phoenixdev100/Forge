import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pause, Plus, Scale, Target, Trash2 } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, humanizeEnum } from '@/lib/format';
import { formatWeight } from '@/lib/units';
import { qk } from '@/lib/queryClient';
import type { BodyMeasurement, Exercise, Goal, GoalMetric, Pagination } from '@/lib/types';
import { toast } from 'sonner';
import { useUnit } from '@/providers/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ProgressRing } from '@/components/ui/Progress';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States';
import { toKg } from '@/lib/units';

const METRIC_OPTIONS: Array<{ value: GoalMetric; label: string; unit: string }> = [
  { value: 'EXERCISE_WEIGHT', label: 'Exercise - weight', unit: 'kg' },
  { value: 'EXERCISE_REPS', label: 'Exercise - reps', unit: 'reps' },
  { value: 'EXERCISE_ONE_RM', label: 'Exercise - est. 1RM', unit: 'kg' },
  { value: 'WORKOUTS_PER_WEEK', label: 'Workouts per week', unit: 'workouts' },
  { value: 'TOTAL_WORKOUTS', label: 'Total workouts', unit: 'workouts' },
  { value: 'BODY_WEIGHT', label: 'Body weight', unit: 'kg' },
  { value: 'BODY_FAT', label: 'Body fat', unit: '%' },
  { value: 'TOTAL_VOLUME', label: 'Total volume', unit: 'kg' },
  { value: 'CUSTOM', label: 'Custom', unit: '' },
];

const NEEDS_EXERCISE: GoalMetric[] = ['EXERCISE_WEIGHT', 'EXERCISE_REPS', 'EXERCISE_ONE_RM'];

function ExerciseSelect({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const [search, setSearch] = useState('');
  const { data } = useQuery({
    queryKey: qk.exercises({ q: search || undefined, pageSize: 12 }),
    queryFn: () => api.get<{ exercises: Exercise[]; pagination: Pagination }>('/exercises', { query: { q: search || undefined, pageSize: 12 } }),
    placeholderData: (p) => p,
  });
  return (
    <div>
      <Input
        label="Exercise"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exercises…"
        error={error}
      />
      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
        {(data?.exercises ?? []).map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onChange(e.id)}
            aria-pressed={value === e.id}
            className={cn(
              'w-full rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm transition-colors',
              value === e.id ? 'border-accent bg-accent-soft text-accent' : 'border-border text-text-muted hover:border-border-strong',
            )}
          >
            {e.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function GoalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const unit = useUnit();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('EXERCISE_WEIGHT');
  const [exerciseId, setExerciseId] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<unknown>(null);

  const metricInfo = METRIC_OPTIONS.find((m) => m.value === metric)!;
  const weightMetric = metric === 'EXERCISE_WEIGHT' || metric === 'EXERCISE_ONE_RM' || metric === 'BODY_WEIGHT' || metric === 'TOTAL_VOLUME';

  const create = useMutation({
    mutationFn: () =>
      api.post<{ goal: Goal }>('/goals', {
        title: title.trim(),
        metric,
        exerciseId: NEEDS_EXERCISE.includes(metric) ? exerciseId : null,
        targetValue: weightMetric && unit === 'LB' ? toKg(target ?? 0, 'LB') : (target ?? 0),
        startValue: null,
        unitLabel: metric === 'CUSTOM' ? (notes ? undefined : '') : undefined,
        deadline: deadline || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.goals });
      toast.success('Goal created.');
      onClose();
    },
    onError: setError,
  });

  const errors = fieldErrors(error);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New goal"
      description="Auto-tracked goals update themselves from your workouts and weigh-ins."
      variant="sheet"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => create.mutate()}
            isLoading={create.isPending}
            disabled={!title.trim() || target == null || (NEEDS_EXERCISE.includes(metric) && !exerciseId)}
          >
            Create goal
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <p role="alert" className="text-sm text-danger">{errorMessage(error)}</p> : null}
        <Input
          label="Goal"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={NEEDS_EXERCISE.includes(metric) ? 'e.g. Bench 100 kg' : 'e.g. Train 4 days a week'}
          error={errors['title']}
          required
          data-autofocus
        />
        <Select label="Track" value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
          {METRIC_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </Select>
        {NEEDS_EXERCISE.includes(metric) ? (
          <ExerciseSelect value={exerciseId} onChange={setExerciseId} error={errors['exerciseId']} />
        ) : null}
        <Input
          label={`Target${weightMetric && unit === 'LB' ? ' (lb)' : metricInfo.unit ? ` (${metricInfo.unit})` : ''}`}
          type="number"
          inputMode="decimal"
          min={0}
          value={target ?? ''}
          onChange={(e) => setTarget(e.target.value === '' ? null : Number(e.target.value))}
          error={errors['targetValue']}
          required
        />
        <Input label="Deadline (optional)" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
    </Dialog>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const unit = useUnit();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editValue, setEditValue] = useState(false);
  const [valueDraft, setValueDraft] = useState<number | null>(goal.currentValue);

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/goals/${goal.id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.goals });
      setEditValue(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/goals/${goal.id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.goals }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const isWeight = ['EXERCISE_WEIGHT', 'EXERCISE_ONE_RM', 'BODY_WEIGHT', 'TOTAL_VOLUME'].includes(goal.metric);
  const fmt = (v: number) => (isWeight ? formatWeight(v, unit) : `${Math.round(v * 10) / 10}${goal.unitLabel ? ` ${goal.unitLabel}` : ''}`);
  const achieved = goal.status === 'ACHIEVED';

  return (
    <Card className={cn(achieved && 'border-success/40')}>
      <CardBody>
        <div className="flex items-start gap-4">
          <ProgressRing value={goal.progress} max={1} size={52}>
            {Math.round(goal.progress * 100)}%
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-text">{goal.title}</p>
              {achieved ? (
                <Badge tone="success" size="sm"><CheckCircle2 className="size-3" aria-hidden /> Done</Badge>
              ) : goal.status === 'PAUSED' ? (
                <Badge size="sm">Paused</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {humanizeEnum(goal.metric)}
              {goal.exercise ? ` · ${goal.exercise.name}` : ''}
              {goal.isAutoTracked ? ' · auto' : ''}
            </p>
            <p className="tnum mt-1.5 text-sm font-medium text-text">
              {fmt(goal.currentValue)} <span className="text-text-subtle">/ {fmt(goal.targetValue)}</span>
            </p>
            {goal.deadline ? <p className="mt-0.5 text-xs text-text-subtle">by {formatDate(goal.deadline, 'd MMM yyyy')}</p> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!achieved ? (
            <>
              {goal.isAutoTracked ? null : editValue ? (
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={valueDraft ?? ''}
                    onChange={(e) => setValueDraft(e.target.value === '' ? null : Number(e.target.value))}
                    aria-label="Current value"
                    className="tnum h-9 w-24 rounded-[var(--radius-control)] border border-border bg-surface-inset px-2 text-sm text-text focus:border-accent focus:outline-none"
                  />
                  <Button size="sm" onClick={() => update.mutate({ currentValue: valueDraft ?? 0 })} isLoading={update.isPending}>Save</Button>
                </span>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setEditValue(true)}>Update progress</Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update.mutate({ status: goal.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' })}
                leftIcon={<Pause className="size-3.5" />}
              >
                {goal.status === 'PAUSED' ? 'Resume' : 'Pause'}
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="icon" aria-label={`Delete goal ${goal.title}`} className="ml-auto text-text-subtle hover:text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardBody>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        isLoading={remove.isPending}
        title={`Delete "${goal.title}"?`}
        confirmLabel="Delete goal"
      />
    </Card>
  );
}

/* ------------------------- Body measurements ----------------------------- */

function MeasurementsSection() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState<number | null>(null);
  const [waist, setWaist] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<unknown>(null);

  const { data } = useQuery({
    queryKey: qk.measurements,
    queryFn: () => api.get<{ measurements: BodyMeasurement[] }>('/measurements'),
  });

  const save = useMutation({
    mutationFn: () =>
      api.post('/measurements', {
        measuredOn: new Date().toISOString().slice(0, 10),
        bodyWeightKg: weight != null ? toKg(weight, unit) : null,
        waistCm: waist,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.measurements });
      setOpen(false);
      setWeight(null);
      setWaist(null);
      setNotes('');
      toast.success('Measurement saved.');
    },
    onError: setError,
  });

  const measurements = data?.measurements ?? [];
  const latest = measurements[0];
  const weightPoints = measurements.filter((m) => m.bodyWeightKg != null).slice(0, 12).reverse();

  return (
    <Card>
      <CardHeader
        title="Body measurements"
        description={latest?.measuredOn ? `Last recorded ${formatDate(latest.measuredOn, 'd MMM')}` : 'Optional - track what you care about.'}
        icon={<Scale className="size-4" />}
        action={<Button variant="ghost" size="sm" onClick={() => setOpen(true)} leftIcon={<Plus className="size-3.5" />}>Log</Button>}
      />
      <CardBody className="pt-4">
        {latest?.bodyWeightKg ? (
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="tnum text-2xl font-semibold text-text">{formatWeight(latest.bodyWeightKg, unit)}</p>
              {weightPoints.length >= 2 ? (
                <p className="mt-0.5 text-xs text-text-subtle">
                  {(() => {
                    const delta = weightPoints[weightPoints.length - 1]!.bodyWeightKg! - weightPoints[0]!.bodyWeightKg!;
                    return `${delta >= 0 ? '+' : ''}${formatWeight(Math.abs(delta), unit).replace(' ', '')} over ${weightPoints.length} readings`;
                  })()}
                </p>
              ) : null}
            </div>
            <div className="flex items-end gap-1" aria-hidden>
              {weightPoints.map((m) => {
                const vals = weightPoints.map((p) => p.bodyWeightKg!);
                const min = Math.min(...vals);
                const range = Math.max(...vals) - min || 1;
                return (
                  <div
                    key={m.id}
                    className="w-3 rounded-t-sm bg-accent/70"
                    style={{ height: `${16 + ((m.bodyWeightKg! - min) / range) * 32 }px` }}
                    title={`${formatDate(m.measuredOn, 'd MMM')}: ${formatWeight(m.bodyWeightKg, unit)}`}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            No measurements yet - log your weight or tape measurements to track body goals.
          </p>
        )}
      </CardBody>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Log measurement"
        variant="sheet"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => save.mutate()} isLoading={save.isPending} disabled={weight == null && waist == null}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <p role="alert" className="text-sm text-danger">{errorMessage(error)}</p> : null}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`Weight (${unit === 'LB' ? 'lb' : 'kg'})`}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={weight ?? ''}
              onChange={(e) => setWeight(e.target.value === '' ? null : Number(e.target.value))}
            />
            <Input
              label="Waist (cm)"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={waist ?? ''}
              onChange={(e) => setWaist(e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Morning weigh-in, fasted…" />
          <p className="text-xs text-text-subtle">More fields coming - today's entry can always be updated.</p>
        </div>
      </Dialog>
    </Card>
  );
}

export default function GoalsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.goals,
    queryFn: () => api.get<{ goals: Goal[] }>('/goals'),
  });

  const active = (data?.goals ?? []).filter((g) => g.status === 'ACTIVE');
  const done = (data?.goals ?? []).filter((g) => g.status !== 'ACTIVE');

  return (
    <div>
      <PageHeader
        title="Goals"
        description="What you're working toward - the auto ones update themselves."
        action={<Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="size-4" />}>New goal</Button>}
      />

      {isPending ? (
        <PageLoader label="Loading goals" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-5">
          {!active.length && !done.length ? (
            <EmptyState
              icon={<Target className="size-5" />}
              title="No goals yet"
              description="Set a weight, reps or consistency target. Exercise goals track themselves from your workouts."
              action={<Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="size-4" />}>Create a goal</Button>}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {active.map((g) => <GoalCard key={g.id} goal={g} />)}
            </div>
          )}

          {done.length ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-subtle uppercase">Done</h2>
              <div className="grid gap-4 opacity-75 lg:grid-cols-2">
                {done.map((g) => <GoalCard key={g.id} goal={g} />)}
              </div>
            </div>
          ) : null}

          <MeasurementsSection />
        </div>
      )}

      <GoalDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
