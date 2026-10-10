import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Dumbbell,
  GripVertical,
  Link2,
  Moon,
  MoreHorizontal,
  Plus,
  Settings2,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatRepRange } from '@/lib/format';
import { qk } from '@/lib/queryClient';
import { TRACKING_LABELS, tracksDistance, tracksReps, tracksTime, tracksWeight } from '@/lib/tracking';
import type { MuscleGroup, Plan, PlanDay, PlanExercise, PlanSet, TrackingType } from '@/lib/types';
import { fromKg, plateStep, toKg, unitLabel } from '@/lib/units';
import { toast } from 'sonner';
import { useUnit } from '@/providers/AuthProvider';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { ExercisePicker } from '@/components/ExercisePicker';
import { Badge, MuscleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Stepper } from '@/components/ui/Stepper';
import { ErrorState, PageLoader } from '@/components/ui/States';

/* ------------------------------------------------------------------ */
/* Small helpers                                                        */
/* ------------------------------------------------------------------ */

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Plan edits sync into a live workout server-side, so refetch sessions too. */
function refreshPlan(qc: ReturnType<typeof useQueryClient>, planId: string) {
  void qc.invalidateQueries({ queryKey: qk.plan(planId) });
  void qc.invalidateQueries({ queryKey: ['sessions'] });
}

/**
 * Supersets read the way lifters write them: A1/A2, B1/B2. Letters follow the
 * order groups appear in the day; a group of one is not a superset.
 */
function supersetLabelsFor(exercises: Array<{ id: string; supersetKey: string | null }>): Record<string, string> {
  const letters = new Map<string, string>();
  const counts = new Map<string, number>();
  const labels: Record<string, string> = {};

  for (const exercise of exercises) {
    const key = exercise.supersetKey;
    if (!key) continue;
    if (!letters.has(key)) letters.set(key, String.fromCharCode(65 + letters.size));
    const position = (counts.get(key) ?? 0) + 1;
    counts.set(key, position);
    labels[exercise.id] = `${letters.get(key)}${position}`;
  }
  for (const exercise of exercises) {
    if (exercise.supersetKey && counts.get(exercise.supersetKey) === 1) delete labels[exercise.id];
  }
  return labels;
}

function dayTitle(position: number, cycleLength: number) {
  return cycleLength === 7 ? WEEKDAY_NAMES[position] ?? `Day ${position + 1}` : `Day ${position + 1}`;
}

/** Sensible target defaults per tracking type - never invented exercise names. */
function defaultTargets(trackingType: TrackingType) {
  if (tracksReps(trackingType)) return { targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 };
  if (tracksTime(trackingType)) return { targetSets: 3, targetRepsMin: null, targetRepsMax: null };
  return { targetSets: 3, targetRepsMin: null, targetRepsMax: null };
}

/* ------------------------------------------------------------------ */
/* Muscle-group editor                                                  */
/* ------------------------------------------------------------------ */

function MuscleGroupEditor({ day, planId }: { day: PlanDay; planId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: qk.muscleGroups(true),
    queryFn: () => api.get<{ muscleGroups: MuscleGroup[] }>('/muscle-groups', { query: { tree: true } }),
    enabled: open,
    staleTime: 10 * 60_000,
  });

  const setGroups = useMutation({
    mutationFn: (muscleGroupIds: string[]) =>
      api.put(`/plans/days/${day.id}/muscle-groups`, { muscleGroupIds }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.plan(planId) }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const current = useMemo(() => new Set(day.muscleGroups.map((m) => m.id)), [day.muscleGroups]);

  const toggle = (id: string) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setGroups.mutate([...next]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {day.muscleGroups.map((m) => (
        <span key={m.rowId} className="group inline-flex items-center">
          <MuscleBadge name={m.name} colorHex={m.colorHex} size="sm" />
          <button
            type="button"
            onClick={() => setGroups.mutate(day.muscleGroups.filter((g) => g.id !== m.id).map((g) => g.id))}
            aria-label={`Remove ${m.name} from this day`}
            className="-ml-1 hidden size-4 items-center justify-center rounded-full bg-surface-inset text-text-subtle group-hover:inline-flex hover:text-danger"
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 text-[11px] font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="size-3" aria-hidden />
          {day.muscleGroups.length ? 'Edit' : 'Add muscle group'}
        </button>
        {open ? (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute left-0 z-20 mt-1.5 w-60 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-raised shadow-[var(--shadow-raised)]">
              <p className="border-b border-border px-3 py-2 text-[11px] font-semibold tracking-wide text-text-subtle uppercase">
                Trained on this day
              </p>
              <div className="max-h-64 overflow-y-auto p-1.5">
                {(data?.muscleGroups ?? []).map((group) => (
                  <div key={group.id}>
                    <MuscleRow group={group} selected={current.has(group.id)} onToggle={() => toggle(group.id)} />
                    {group.children?.map((child) => (
                      <div key={child.id} className="pl-4">
                        <MuscleRow group={child} selected={current.has(child.id)} onToggle={() => toggle(child.id)} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-2">
                <Button size="sm" fullWidth onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MuscleRow({ group, selected, onToggle }: { group: MuscleGroup; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-sm transition-colors',
        selected ? 'bg-accent-soft text-accent' : 'text-text-muted hover:bg-surface-hover hover:text-text',
      )}
    >
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ backgroundColor: group.colorHex }} aria-hidden />
        {group.name}
      </span>
      {selected ? <Check className="size-4" aria-hidden /> : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Exercise configuration dialog                                        */
/* ------------------------------------------------------------------ */

type SetDraft = {
  setType: PlanSet['setType'];
  targetReps: number | null;
  targetRepsMax: number | null;
  targetWeightDisplay: number | null; // in the user's unit
  targetTimeSeconds: number | null;
  targetDistanceM: number | null;
  restSeconds: number | null;
};

function ExerciseConfigDialog({
  planExercise,
  planId,
  open,
  onClose,
}: {
  planExercise: PlanExercise;
  planId: string;
  open: boolean;
  onClose: () => void;
}) {
  const unit = useUnit();
  const queryClient = useQueryClient();
  const tracking = planExercise.effectiveTrackingType;

  const [targetSets, setTargetSets] = useState<number | null>(planExercise.targetSets);
  const [repsMin, setRepsMin] = useState<number | null>(planExercise.targetRepsMin);
  const [repsMax, setRepsMax] = useState<number | null>(planExercise.targetRepsMax);
  const [weight, setWeight] = useState<number | null>(
    planExercise.targetWeightKg != null ? fromKg(planExercise.targetWeightKg, unit) : null,
  );
  const [time, setTime] = useState<number | null>(planExercise.targetTimeSeconds);
  const [distance, setDistance] = useState<number | null>(planExercise.targetDistanceM);
  const [rest, setRest] = useState<number | null>(planExercise.restSeconds ?? planExercise.effectiveRestSeconds);
  const [notes, setNotes] = useState(planExercise.notes ?? '');
  const [error, setError] = useState<unknown>(null);
  const [advanced, setAdvanced] = useState(planExercise.plannedSets.length > 0);
  const [setDrafts, setSetDrafts] = useState<SetDraft[]>(() =>
    planExercise.plannedSets.map((s) => ({
      setType: s.setType,
      targetReps: s.targetReps,
      targetRepsMax: s.targetRepsMax,
      targetWeightDisplay: s.targetWeightKg != null ? fromKg(s.targetWeightKg, unit) : null,
      targetTimeSeconds: s.targetTimeSeconds,
      targetDistanceM: s.targetDistanceM,
      restSeconds: s.restSeconds,
    })),
  );

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/plans/exercises/${planExercise.id}`, {
        targetSets,
        targetRepsMin: repsMin,
        targetRepsMax: repsMax,
        targetWeightKg: weight != null ? toKg(weight, unit) : null,
        targetTimeSeconds: time,
        targetDistanceM: distance,
        restSeconds: rest,
        notes: notes.trim() || null,
      });
      if (advanced) {
        await api.put(`/plans/exercises/${planExercise.id}/sets`, {
          sets: setDrafts.map((s) => ({
            setType: s.setType,
            targetReps: s.targetReps,
            targetRepsMax: s.targetRepsMax,
            targetWeightKg: s.targetWeightDisplay != null ? toKg(s.targetWeightDisplay, unit) : null,
            targetTimeSeconds: s.targetTimeSeconds,
            targetDistanceM: s.targetDistanceM,
            restSeconds: s.restSeconds,
          })),
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.plan(planId) });
      toast.success('Targets updated.');
      onClose();
    },
    onError: setError,
  });

  const syncSetCount = (count: number) => {
    setSetDrafts((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push({
          setType: 'NORMAL',
          targetReps: repsMin,
          targetRepsMax: repsMax,
          targetWeightDisplay: weight,
          targetTimeSeconds: time,
          targetDistanceM: distance,
          restSeconds: rest,
        });
      }
      return next.slice(0, count);
    });
  };

  const errors = fieldErrors(error);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={planExercise.exercise.name}
      description="Targets are a starting point - every set stays adjustable during the workout."
      variant="sheet"
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => save.mutate()} isLoading={save.isPending}>Save targets</Button>
        </>
      }
    >
      <div className="space-y-5">
        {error ? <p role="alert" className="text-sm text-danger">{errorMessage(error)}</p> : null}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stepper
            label="Sets"
            value={targetSets}
            onChange={(v) => {
              setTargetSets(v);
              if (v != null) syncSetCount(v);
            }}
            min={0}
            max={50}
          />
          {tracksReps(tracking) ? (
            <>
              <Stepper label="Reps min" value={repsMin} onChange={setRepsMin} min={0} max={500} />
              <Stepper label="Reps max" value={repsMax} onChange={setRepsMax} min={0} max={500} />
            </>
          ) : null}
          {tracksWeight(tracking) ? (
            <Stepper
              label={`Weight (${unitLabel(unit)})`}
              value={weight}
              onChange={setWeight}
              step={plateStep(unit)}
              min={0}
              max={1000}
              allowDecimals
            />
          ) : null}
          {tracksTime(tracking) ? (
            <Stepper label="Time (sec)" value={time} onChange={setTime} step={5} min={0} max={86400} />
          ) : null}
          {tracksDistance(tracking) ? (
            <Stepper label="Distance (m)" value={distance} onChange={setDistance} step={50} min={0} max={100000} allowDecimals />
          ) : null}
          <Stepper label="Rest (sec)" value={rest} onChange={setRest} step={15} min={0} max={1800} />
        </div>
        {errors['targetRepsMin'] ? <p className="text-sm text-danger">{errors['targetRepsMin']}</p> : null}

        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder='e.g. "Pause at the bottom", "wide grip"'
          rows={2}
        />

        {/* Advanced: per-set targets for pyramids / ramp-ups */}
        <div className="rounded-[var(--radius-card)] border border-border">
          <button
            type="button"
            onClick={() => {
              const next = !advanced;
              setAdvanced(next);
              if (next && setDrafts.length === 0) syncSetCount(targetSets ?? 3);
            }}
            aria-expanded={advanced}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text"
          >
            <span className="flex items-center gap-2">
              <Settings2 className="size-4 text-text-subtle" aria-hidden />
              Per-set targets (pyramids, warm-ups)
            </span>
            {advanced ? <ChevronUp className="size-4 text-text-subtle" /> : <ChevronDown className="size-4 text-text-subtle" />}
          </button>
          {advanced ? (
            <div className="space-y-2 border-t border-border p-3">
              {setDrafts.map((set, i) => (
                <div key={i} className="flex items-center gap-2 rounded-[var(--radius-control)] bg-surface-inset p-2">
                  <span className="tnum w-7 shrink-0 text-center text-xs font-medium text-text-subtle">{i + 1}</span>
                  <Select
                    aria-label={`Set ${i + 1} type`}
                    containerClassName="w-28 shrink-0"
                    className="h-9"
                    value={set.setType}
                    onChange={(e) =>
                      setSetDrafts((prev) => prev.map((s, j) => (j === i ? { ...s, setType: e.target.value as PlanSet['setType'] } : s)))
                    }
                  >
                    <option value="NORMAL">Working</option>
                    <option value="WARMUP">Warm-up</option>
                    <option value="DROP">Drop</option>
                    <option value="BACKOFF">Back-off</option>
                    <option value="FAILURE">Failure</option>
                    <option value="AMRAP">AMRAP</option>
                  </Select>
                  {tracksWeight(tracking) ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Set ${i + 1} weight (${unitLabel(unit)})`}
                      placeholder={unitLabel(unit)}
                      value={set.targetWeightDisplay ?? ''}
                      onChange={(e) =>
                        setSetDrafts((prev) =>
                          prev.map((s, j) => (j === i ? { ...s, targetWeightDisplay: e.target.value === '' ? null : Number(e.target.value) } : s)),
                        )
                      }
                      className="tnum h-9 min-w-12 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-2 text-center text-sm text-text"
                    />
                  ) : null}
                  {tracksReps(tracking) ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Set ${i + 1} reps`}
                      placeholder="reps"
                      value={set.targetReps ?? ''}
                      onChange={(e) =>
                        setSetDrafts((prev) =>
                          prev.map((s, j) => (j === i ? { ...s, targetReps: e.target.value === '' ? null : Number(e.target.value) } : s)),
                        )
                      }
                      className="tnum h-9 min-w-12 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-2 text-center text-sm text-text"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSetDrafts((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove set ${i + 1}`}
                    className="ml-auto flex size-8 items-center justify-center rounded text-text-subtle hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="size-3.5" />}
                onClick={() =>
                  setSetDrafts((prev) => [
                    ...prev,
                    {
                      setType: 'NORMAL',
                      targetReps: repsMin,
                      targetRepsMax: repsMax,
                      targetWeightDisplay: weight,
                      targetTimeSeconds: time,
                      targetDistanceM: distance,
                      restSeconds: rest,
                    },
                  ])
                }
              >
                Add set
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Sortable exercise row                                                */
/* ------------------------------------------------------------------ */

function ExerciseRow({
  planExercise,
  planId,
  previous,
  supersetLabel,
  onConfigure,
}: {
  planExercise: PlanExercise;
  planId: string;
  /** The row above - supersets are built by joining upwards. */
  previous: PlanExercise | null;
  supersetLabel: string | null;
  onConfigure: () => void;
}) {
  const unit = useUnit();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: planExercise.id });

  const setSuperset = useMutation({
    mutationFn: (supersetKey: string | null) =>
      api.patch(`/plans/exercises/${planExercise.id}`, { supersetKey }),
    onSuccess: () => refreshPlan(queryClient, planId),
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Joining the row above either extends its existing group or starts a new one.
  const joinPrevious = () => {
    if (!previous) return;
    const key = previous.supersetKey ?? `ss-${previous.id.slice(-8)}`;
    if (!previous.supersetKey) {
      api
        .patch(`/plans/exercises/${previous.id}`, { supersetKey: key })
        .then(() => setSuperset.mutate(key))
        .catch((err) => toast.error(errorMessage(err)));
      return;
    }
    setSuperset.mutate(key);
  };

  const remove = useMutation({
    mutationFn: () => api.delete(`/plans/exercises/${planExercise.id}`),
    onSuccess: () => refreshPlan(queryClient, planId),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const duplicate = useMutation({
    mutationFn: () => api.post(`/plans/exercises/${planExercise.id}/duplicate`),
    onSuccess: () => refreshPlan(queryClient, planId),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const tracking = planExercise.effectiveTrackingType;
  const summary: string[] = [];
  if (planExercise.targetSets) summary.push(`${planExercise.targetSets} sets`);
  const repRange = formatRepRange(planExercise.targetRepsMin, planExercise.targetRepsMax);
  if (repRange !== '-' && tracksReps(tracking)) summary.push(`${repRange} reps`);
  if (planExercise.targetWeightKg != null && tracksWeight(tracking)) {
    summary.push(`${fromKg(planExercise.targetWeightKg, unit)} ${unitLabel(unit)}`);
  }
  if (planExercise.targetTimeSeconds != null && tracksTime(tracking)) summary.push(`${planExercise.targetTimeSeconds}s`);
  if (planExercise.restSeconds ?? planExercise.effectiveRestSeconds) {
    summary.push(`${planExercise.restSeconds ?? planExercise.effectiveRestSeconds}s rest`);
  }
  if (planExercise.plannedSets.length) summary.push('per-set targets');

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-2 py-2.5 sm:gap-3 sm:px-3',
        isDragging && 'z-10 border-accent shadow-[var(--shadow-raised)]',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${planExercise.exercise.name}`}
        className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-text-subtle hover:text-text active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <ExerciseMedia media={planExercise.exercise.media} name={planExercise.exercise.name} mode="thumb" className="size-11 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-text">
          {supersetLabel ? (
            <Badge size="sm" tone="accent" title="Superset - performed back-to-back">{supersetLabel}</Badge>
          ) : null}
          <Link to={`/app/exercises/${planExercise.exercise.slug}`} className="truncate hover:text-accent" onClick={(e) => e.stopPropagation()}>
            {planExercise.exercise.name}
          </Link>
        </p>
        <p className="mt-0.5 truncate text-xs text-text-muted">
          {summary.length ? summary.join(' · ') : TRACKING_LABELS[tracking]}
        </p>
        {planExercise.notes ? (
          <p className="mt-0.5 truncate text-xs text-text-subtle italic">"{planExercise.notes}"</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center">
        <Button variant="ghost" size="sm" onClick={onConfigure} aria-label={`Configure ${planExercise.exercise.name}`}>
          <Settings2 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Targets</span>
        </Button>
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label={`More options for ${planExercise.exercise.name}`} onClick={() => setMenuOpen((v) => !v)}>
            <MoreHorizontal className="size-4" />
          </Button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-raised shadow-[var(--shadow-raised)]">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text-muted hover:bg-surface-hover hover:text-text"
                  onClick={() => { setMenuOpen(false); duplicate.mutate(); }}
                >
                  <Copy className="size-4" aria-hidden /> Duplicate
                </button>
                {planExercise.supersetKey ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text-muted hover:bg-surface-hover hover:text-text"
                    onClick={() => { setMenuOpen(false); setSuperset.mutate(null); }}
                  >
                    <Unlink className="size-4" aria-hidden /> Leave superset
                  </button>
                ) : previous ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text-muted hover:bg-surface-hover hover:text-text"
                    onClick={() => { setMenuOpen(false); joinPrevious(); }}
                  >
                    <Link2 className="size-4" aria-hidden /> Superset with above
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2.5 text-sm text-text-muted hover:bg-surface-hover hover:text-danger"
                  onClick={() => { setMenuOpen(false); remove.mutate(); }}
                >
                  <Trash2 className="size-4" aria-hidden /> Remove
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Day settings dialog                                                  */
/* ------------------------------------------------------------------ */

function DaySettingsDialog({ day, planId, open, onClose }: { day: PlanDay; planId: string; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(day.label ?? '');
  const [notes, setNotes] = useState(day.notes ?? '');
  const [minutes, setMinutes] = useState<number | null>(day.estimatedMinutes);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/plans/days/${day.id}`, {
        label: label.trim() || null,
        notes: notes.trim() || null,
        estimatedMinutes: minutes,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.plan(planId) });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const duplicateDay = useMutation({
    mutationFn: () => api.post(`/plans/days/${day.id}/duplicate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.plan(planId) });
      toast.success('Day duplicated.');
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteDay = useMutation({
    mutationFn: () => api.delete(`/plans/days/${day.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.plan(planId) });
      setConfirmDelete(false);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`${day.positionLabel} settings`}
        variant="sheet"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => update.mutate()} isLoading={update.isPending}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Day label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={day.displayLabel}
            hint={day.muscleGroups.length ? 'Leave blank to use the muscle group names.' : undefined}
          />
          <Stepper label="Estimated duration (min)" value={minutes} onChange={setMinutes} step={5} min={0} max={600} />
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. light day, focus on form" />
          <div className="flex gap-2 border-t border-border pt-3">
            <Button variant="secondary" size="sm" leftIcon={<Copy className="size-3.5" />} onClick={() => duplicateDay.mutate()} isLoading={duplicateDay.isPending}>
              Duplicate day
            </Button>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger" leftIcon={<Trash2 className="size-3.5" />} onClick={() => setConfirmDelete(true)}>
              Delete day
            </Button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteDay.mutate()}
        isLoading={deleteDay.isPending}
        title={`Delete ${day.displayLabel}?`}
        description="Its exercises are removed from the plan. Past workouts are not affected."
        confirmLabel="Delete day"
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The day editor                                                       */
/* ------------------------------------------------------------------ */

function DayEditor({ day, planId }: { day: PlanDay; planId: string }) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configuring, setConfiguring] = useState<PlanExercise | null>(null);
  const [exerciseIds, setExerciseIds] = useState<string[] | null>(null);

  const exercises = useMemo(() => {
    if (!exerciseIds) return day.exercises;
    const byId = new Map(day.exercises.map((e) => [e.id, e]));
    const ordered = exerciseIds.map((id) => byId.get(id)).filter((e): e is PlanExercise => Boolean(e));
    // Newly added exercises that arrived after the optimistic reorder go last.
    const missing = day.exercises.filter((e) => !exerciseIds.includes(e.id));
    return [...ordered, ...missing];
  }, [day.exercises, exerciseIds]);

  const supersetLabels = useMemo(() => supersetLabelsFor(exercises), [exercises]);

  const sensors = useSensors(
    // Distance constraint keeps vertical scrolling working on touch.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => api.put(`/plans/days/${day.id}/exercises/order`, { orderedIds }),
    onSuccess: () => refreshPlan(queryClient, planId),
    onError: (err) => {
      setExerciseIds(null);
      toast.error(errorMessage(err, 'Could not reorder - reload and try again.'));
    },
  });

  const addBulk = useMutation({
    mutationFn: (body: { exercises: Array<Record<string, unknown>> }) => api.post(`/plans/days/${day.id}/exercises/bulk`, body),
    onSuccess: () => refreshPlan(queryClient, planId),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const setRest = useMutation({
    mutationFn: (dayType: 'WORKOUT' | 'REST') => api.patch(`/plans/days/${day.id}`, { dayType }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.plan(planId) }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = exercises.map((e) => e.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(to, 0, ...next.splice(from, 1));
    setExerciseIds(next);
    reorder.mutate(next);
  }

  const isRest = day.dayType === 'REST';
  const firstMuscleSlug = day.muscleGroups[0]?.slug;
  const firstMuscleId = day.muscleGroups[0]?.id;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-text-subtle uppercase">{day.positionLabel}</p>
          <h2 className="mt-0.5 truncate text-base font-semibold text-text">{day.displayLabel}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={isRest ? 'neutral' : 'accent'} size="sm">{isRest ? 'Rest' : `${day.exerciseCount} exercises`}</Badge>
          <Button variant="ghost" size="icon" aria-label="Day settings" onClick={() => setSettingsOpen(true)}>
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <MuscleGroupEditor day={day} planId={planId} />

        {isRest ? (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-surface-inset px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Moon className="size-4" aria-hidden /> Rest day - recovery counts toward your streak.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setRest.mutate('WORKOUT')}>Make it a training day</Button>
          </div>
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
              <SortableContext items={exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2" aria-label={`${day.displayLabel} exercises`}>
                  {exercises.map((pe, index) => (
                    <ExerciseRow
                      key={pe.id}
                      planExercise={pe}
                      planId={planId}
                      previous={index > 0 ? exercises[index - 1] ?? null : null}
                      supersetLabel={supersetLabels[pe.id] ?? null}
                      onConfigure={() => setConfiguring(pe)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>

            {!exercises.length ? (
              <p className="rounded-[var(--radius-control)] border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
                No exercises yet - add from the library below.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setPickerOpen(true)}>
                Add exercises
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRest.mutate('REST')} isLoading={setRest.isPending}>
                Mark as rest day
              </Button>
            </div>
          </>
        )}
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode="multi"
        title={`Add to ${day.displayLabel}`}
        initialMuscleSlug={firstMuscleSlug}
        excludeIds={exercises.map((e) => e.exercise.id)}
        onAdd={(picked) => {
          addBulk.mutate({
            exercises: picked.map((exercise) => ({
              exerciseId: exercise.id,
              muscleGroupId: firstMuscleId ?? null,
              ...defaultTargets(exercise.trackingType),
            })),
          });
        }}
      />

      <DaySettingsDialog day={day} planId={planId} open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {configuring ? (
        <ExerciseConfigDialog
          planExercise={configuring}
          planId={planId}
          open={Boolean(configuring)}
          onClose={() => setConfiguring(null)}
        />
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Plan settings                                                        */
/* ------------------------------------------------------------------ */

function PlanSettingsDialog({ plan, open, onClose }: { plan: Plan; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? '');
  const [cycleLength, setCycleLength] = useState(plan.cycleLength);
  const [startsOn, setStartsOn] = useState(plan.startsOn ?? '');

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/plans/${plan.id}`, {
        name: name.trim(),
        description: description.trim() || null,
        cycleLength,
        startsOn: startsOn || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.plan(plan.id) });
      void queryClient.invalidateQueries({ queryKey: qk.plans });
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
      toast.success('Plan updated.');
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Plan settings"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => update.mutate()} isLoading={update.isPending} disabled={!name.trim()}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Plan name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <Select
          label="Cycle length"
          value={cycleLength}
          onChange={(e) => setCycleLength(Number(e.target.value))}
          hint="7 = repeats weekly. Other lengths rotate continuously from the start date."
        >
          {[3, 4, 5, 6, 7, 8, 9, 10, 14, 21, 28].map((n) => (
            <option key={n} value={n}>{n} days{n === 7 ? ' (weekly)' : ''}</option>
          ))}
        </Select>
        <Input
          label={cycleLength === 7 ? 'Starts on (optional)' : 'Cycle starts on'}
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          hint={cycleLength === 7 ? 'Weekly cycles always align to weekdays.' : 'Required for non-weekly cycles to line up with the calendar.'}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* The builder                                                          */
/* ------------------------------------------------------------------ */

export default function PlanBuilderPage() {
  const { planId } = useParams<{ planId: string }>();
  const queryClient = useQueryClient();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.plan(planId!),
    queryFn: () => api.get<{ plan: Plan }>(`/plans/${planId}`),
    enabled: Boolean(planId),
  });

  const addDay = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post(`/plans/${planId}/days`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.plan(planId!) }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const activate = useMutation({
    mutationFn: () => api.post(`/plans/${planId}/activate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.plan(planId!) });
      void queryClient.invalidateQueries({ queryKey: qk.plans });
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
      void queryClient.invalidateQueries({ queryKey: qk.dashboard });
      toast.success('This plan is now active.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isPending) return <PageLoader label="Loading your plan" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const plan = data.plan;
  const daysByPosition = new Map(plan.days.map((d) => [d.position, d]));
  const selectedDay = daysByPosition.get(selectedDayIndex) ?? null;
  const positions = Array.from({ length: plan.cycleLength }, (_, i) => i);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/app/plans" className="mb-2 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> All plans
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-xl font-semibold tracking-tight text-text sm:text-2xl">{plan.name}</h1>
              {plan.isActive ? <Badge tone="accent">Active</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {plan.workoutDayCount} training days · {plan.totalExerciseCount} exercises · {plan.cycleLength}-day cycle
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!plan.isActive ? (
              <Button variant="secondary" onClick={() => activate.mutate()} isLoading={activate.isPending}>
                Set active
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setSettingsOpen(true)} leftIcon={<Settings2 className="size-4" />}>
              Plan settings
            </Button>
          </div>
        </div>
      </div>

      {/* Day selector - the full cycle, scrollable on mobile */}
      <div className="scrollbar-none -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Days in this plan">
        {positions.map((position) => {
          const day = daysByPosition.get(position);
          const isRest = day?.dayType === 'REST';
          const isEmpty = !day;
          const active = selectedDayIndex === position;
          return (
            <button
              key={position}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedDayIndex(position)}
              className={cn(
                'flex min-w-22 shrink-0 flex-col items-center gap-1 rounded-[var(--radius-control)] border px-3 py-2.5 text-center transition-colors',
                active
                  ? 'border-accent bg-accent-soft'
                  : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <span className={cn('text-[11px] font-semibold tracking-wide uppercase', active ? 'text-accent' : 'text-text-subtle')}>
                {dayTitle(position, plan.cycleLength)}
              </span>
              <span className={cn('max-w-24 truncate text-xs', active ? 'text-text' : 'text-text-muted')}>
                {isEmpty ? 'Empty' : isRest ? 'Rest' : day!.displayLabel}
              </span>
              {day && !isRest ? <span className="tnum text-[10px] text-text-subtle">{day.exerciseCount} ex</span> : null}
            </button>
          );
        })}
      </div>

      {/* Selected day editor */}
      {selectedDay ? (
        <DayEditor key={selectedDay.id} day={selectedDay} planId={plan.id} />
      ) : (
        <Card>
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-inset text-text-subtle">
              <CalendarClock className="size-5" aria-hidden />
            </div>
            <h3 className="text-base font-semibold text-text">{dayTitle(selectedDayIndex, plan.cycleLength)} has nothing planned</h3>
            <p className="mt-1.5 max-w-sm text-sm text-text-muted">
              Add a workout for this day, or leave it empty - unscheduled days count as rest.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                leftIcon={<Dumbbell className="size-4" />}
                isLoading={addDay.isPending}
                onClick={() =>
                  addDay.mutate({ position: selectedDayIndex, dayType: 'WORKOUT' }, {
                    onSuccess: () => setSelectedDayIndex(selectedDayIndex),
                  })
                }
              >
                Add workout day
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Moon className="size-4" />}
                isLoading={addDay.isPending}
                onClick={() => addDay.mutate({ position: selectedDayIndex, dayType: 'REST', label: 'Rest' })}
              >
                Mark as rest
              </Button>
            </div>
          </div>
        </Card>
      )}

      <PlanSettingsDialog plan={plan} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
