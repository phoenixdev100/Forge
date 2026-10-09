import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp, History, Plus, SkipForward, Trash2, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatRepRange } from '@/lib/format';
import { qk } from '@/lib/queryClient';
import {
  formatSet,
  setHasValue,
  setTypeBadge,
  tracksDistance,
  tracksReps,
  tracksTime,
  tracksWeight,
  weightFieldLabel,
  weightIsOptional,
} from '@/lib/tracking';
import type { SessionExercise, SessionSet, WorkoutSession } from '@/lib/types';
import { formatWeight, fromKg, plateStep, toKg, unitLabel, type Unit } from '@/lib/units';
import { toast } from 'sonner';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { useRestTimer } from './RestTimer';

type SetUpdate = Partial<Pick<SessionSet, 'reps' | 'timeSeconds' | 'distanceM' | 'rpe' | 'notes' | 'isCompleted' | 'setType'> & { weightKg: number | null }>;

/* ------------------------------------------------------------------ */
/* One set: big steppers + a completion target you can hit blind        */
/* ------------------------------------------------------------------ */

function SetRow({
  sessionId,
  exercise,
  set,
  previous,
  unit,
}: {
  sessionId: string;
  exercise: SessionExercise;
  set: SessionSet;
  previous?: { weightKg: number | null; reps: number | null; timeSeconds: number | null; distanceM: number | null };
  unit: Unit;
}) {
  const queryClient = useQueryClient();
  const restTimer = useRestTimer();
  const tracking = exercise.trackingType;
  const typeBadge = setTypeBadge(set.setType);

  // Optimistic local values so typing never waits for the network.
  const [draft, setDraft] = useState<{
    weightDisplay: number | null;
    reps: number | null;
    timeSeconds: number | null;
    distanceM: number | null;
  } | null>(null);

  const weightDisplay = draft?.weightDisplay ?? (set.weightKg != null ? fromKg(set.weightKg, unit) : null);
  const reps = draft?.reps ?? set.reps;
  const timeSeconds = draft?.timeSeconds ?? set.timeSeconds;
  const distanceM = draft?.distanceM ?? set.distanceM;

  const persist = (update: SetUpdate) => {
    // Optimistically update the cached session so the UI is instant.
    queryClient.setQueryData<{ session: WorkoutSession }>(qk.session(sessionId), (old) => {
      if (!old) return old;
      return {
        session: {
          ...old.session,
          exercises: old.session.exercises.map((e) =>
            e.id !== exercise.id
              ? e
              : { ...e, sets: e.sets.map((s) => (s.id === set.id ? { ...s, ...update } : s)) },
          ),
        },
      };
    });
    setMutation.mutate(update);
  };

  const setMutation = useMutation({
    mutationFn: (update: SetUpdate) => api.patch(`/sessions/sets/${set.id}`, update),
    onError: (err) => {
      toast.error(errorMessage(err, 'Unable to save this set. Please try again.'));
      void queryClient.invalidateQueries({ queryKey: qk.session(sessionId) });
    },
  });

  const deleteSet = useMutation({
    mutationFn: () => api.delete(`/sessions/sets/${set.id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.session(sessionId) }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const commitValue = (patch: { weightDisplay?: number | null; reps?: number | null; timeSeconds?: number | null; distanceM?: number | null }) => {
    setDraft((d) => ({
      weightDisplay: patch.weightDisplay !== undefined ? patch.weightDisplay : (d?.weightDisplay ?? (set.weightKg != null ? fromKg(set.weightKg, unit) : null)),
      reps: patch.reps !== undefined ? patch.reps : (d?.reps ?? set.reps),
      timeSeconds: patch.timeSeconds !== undefined ? patch.timeSeconds : (d?.timeSeconds ?? set.timeSeconds),
      distanceM: patch.distanceM !== undefined ? patch.distanceM : (d?.distanceM ?? set.distanceM),
    }));
    const update: SetUpdate = {};
    if (patch.weightDisplay !== undefined) update.weightKg = patch.weightDisplay != null ? toKg(patch.weightDisplay, unit) : null;
    if (patch.reps !== undefined) update.reps = patch.reps;
    if (patch.timeSeconds !== undefined) update.timeSeconds = patch.timeSeconds;
    if (patch.distanceM !== undefined) update.distanceM = patch.distanceM;
    persist(update);
  };

  const toggleComplete = () => {
    const completing = !set.isCompleted;
    persist({ isCompleted: completing });
    if (completing) {
      // The rest timer belongs to the exercise, configured per-plan.
      const rest = exercise.restSeconds ?? exercise.exercise.defaultRestSeconds;
      if (rest > 0) restTimer.start(rest);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-control)] border px-2 py-1.5 transition-colors',
        set.isCompleted ? 'border-success/30 bg-success-soft/50' : 'border-border bg-surface-inset',
      )}
    >
      {/* Col 1: set number (+ type badge + last-time, stacked small) */}
      <div className="w-12 shrink-0">
        <span className="tnum text-xs font-semibold tracking-wide text-text-subtle uppercase">
          Set {set.setNumber}
        </span>
        {typeBadge ? <Badge size="sm" tone={set.setType === 'WARMUP' ? 'info' : 'neutral'}>{typeBadge}</Badge> : null}
        {previous ? (
          <span className="tnum block text-[10px] text-text-subtle" title="Last time">
            {formatSet(previous, tracking, unit)}
          </span>
        ) : null}
      </div>

      {/* Cols 2-3: the steppers */}
      <div className="grid flex-1 grid-cols-2 gap-1.5">
          {tracksWeight(tracking) ? (
            <Stepper
              size="xs"
              label={weightIsOptional(tracking) ? `${weightFieldLabel(tracking)} (${unitLabel(unit)})` : `Weight (${unitLabel(unit)})`}
              value={weightDisplay}
              onChange={(v) => commitValue({ weightDisplay: v })}
              step={plateStep(unit)}
              min={0}
              max={999}
              allowDecimals
              aria-label={`Set ${set.setNumber} weight`}
            />
          ) : null}
          {tracksReps(tracking) ? (
            <Stepper
              size="xs"
              label={tracking === 'AMRAP' ? 'Reps (max)' : 'Reps'}
              value={reps}
              onChange={(v) => commitValue({ reps: v })}
              min={0}
              max={999}
              aria-label={`Set ${set.setNumber} reps`}
            />
          ) : null}
          {tracksTime(tracking) ? (
            <Stepper
              size="xs"
              label="Time (sec)"
              value={timeSeconds}
              onChange={(v) => commitValue({ timeSeconds: v })}
              step={5}
              min={0}
              max={86400}
              aria-label={`Set ${set.setNumber} time`}
            />
          ) : null}
          {tracksDistance(tracking) ? (
            <Stepper
              size="xs"
              label="Distance (m)"
              value={distanceM}
              onChange={(v) => commitValue({ distanceM: v })}
              step={25}
              min={0}
              max={100000}
              allowDecimals
              aria-label={`Set ${set.setNumber} distance`}
            />
          ) : null}
        </div>

        {/* The completion target: deliberately the biggest thing in the row. */}
        <button
          type="button"
          onClick={toggleComplete}
          disabled={!set.isCompleted && !setHasValue({ reps, timeSeconds, distanceM })}
          aria-pressed={set.isCompleted}
          aria-label={set.isCompleted ? `Mark set ${set.setNumber} as not done` : `Complete set ${set.setNumber}`}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-95',
            set.isCompleted
              ? 'border-success bg-success text-white'
              : 'border-border-strong text-text-subtle hover:border-accent hover:text-accent disabled:opacity-40',
          )}
        >
          <Check className="size-5" aria-hidden />
        </button>

        {/* Any non-completed set is removable while >1 set remains - the ✕
            gives quick cleanup of extra/added sets. */}
        {!set.isCompleted && exercise.sets.length > 1 ? (
          <button
            type="button"
            onClick={() => deleteSet.mutate()}
            aria-label={`Remove set ${set.setNumber}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-surface-hover hover:text-danger"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
  );
}

/* ------------------------------------------------------------------ */
/* One exercise in the workout                                          */
/* ------------------------------------------------------------------ */

export function SessionExerciseCard({
  sessionId,
  exercise,
  unit,
  previous,
  isCurrent,
}: {
  sessionId: string;
  exercise: SessionExercise;
  unit: Unit;
  previous: WorkoutSession['previousPerformance'][string] | undefined;
  isCurrent: boolean;
}) {
  const queryClient = useQueryClient();
  const [showPrevious, setShowPrevious] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(exercise.notes ?? '');

  const addSet = useMutation({
    mutationFn: () => api.post(`/sessions/exercises/${exercise.id}/sets`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.session(sessionId) }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const update = useMutation({
    mutationFn: (body: { notes?: string | null; isSkipped?: boolean }) =>
      api.patch(`/sessions/exercises/${exercise.id}`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.session(sessionId) }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const removeExercise = useMutation({
    mutationFn: () => api.delete(`/sessions/exercises/${exercise.id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.session(sessionId) }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const targetText = [
    exercise.targetSets ? `${exercise.targetSets} sets` : null,
    tracksReps(exercise.trackingType) ? formatRepRange(exercise.targetRepsMin, exercise.targetRepsMax) !== '-'
      ? `${formatRepRange(exercise.targetRepsMin, exercise.targetRepsMax)} reps`
      : null
    : null,
    exercise.targetWeightKg != null && tracksWeight(exercise.trackingType)
      ? formatWeight(exercise.targetWeightKg, unit)
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const done = exercise.progress.completedSets;
  const total = exercise.sets.length;
  const complete = exercise.progress.isComplete || exercise.isSkipped;

  return (
    <section
      id={`exercise-${exercise.id}`}
      aria-label={exercise.nameSnapshot}
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] border bg-surface',
        isCurrent && !complete ? 'border-accent/50' : 'border-border',
        exercise.isSkipped && 'opacity-60',
      )}
    >
      {/* Header - exercise media, name, target, progress */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2 sm:px-4">
        <ExerciseMedia media={exercise.exercise.media} name={exercise.nameSnapshot} mode="card" className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn('truncate text-sm font-semibold text-text sm:text-base', exercise.isSkipped && 'line-through')}>
              {exercise.nameSnapshot}
            </h3>
            {exercise.isSkipped ? <Badge size="sm" tone="neutral">Skipped</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {targetText || 'Log what you do'}
            {exercise.muscleGroup ? ` · ${exercise.muscleGroup.name}` : ''}
          </p>
          <p className="tnum mt-0.5 text-[11px] text-text-subtle">
            {done}/{total} sets
            {exercise.progress.volumeKg ? ` · ${formatWeight(exercise.progress.volumeKg, unit)}` : ''}
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={`Options for ${exercise.nameSnapshot}`}
            aria-expanded={menuOpen}
            className="flex size-9 items-center justify-center rounded-[var(--radius-control)] text-text-subtle transition-colors hover:bg-surface-hover hover:text-text"
          >
            <ChevronDown className={cn('size-4 transition-transform', menuOpen && 'rotate-180')} aria-hidden />
          </button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-raised shadow-[var(--shadow-raised)]">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-muted hover:bg-surface-hover hover:text-text"
                  onClick={() => { setMenuOpen(false); setNoteDraft(exercise.notes ?? ''); setNoteOpen(true); }}
                >
                  Exercise note
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-muted hover:bg-surface-hover hover:text-text"
                  onClick={() => { setMenuOpen(false); update.mutate({ isSkipped: !exercise.isSkipped }); }}
                >
                  <SkipForward className="size-4" aria-hidden /> {exercise.isSkipped ? 'Unskip' : 'Skip exercise'}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2 text-sm text-text-muted hover:bg-surface-hover hover:text-danger"
                  onClick={() => { setMenuOpen(false); removeExercise.mutate(); }}
                >
                  <Trash2 className="size-4" aria-hidden /> Remove from workout
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Last time - collapsed by default, one tap to expand */}
      {previous ? (
        <div className="border-b border-border bg-surface-inset/60">
          <button
            type="button"
            onClick={() => setShowPrevious((v) => !v)}
            aria-expanded={showPrevious}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left sm:px-4"
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
              <History className="size-3.5" aria-hidden />
              Last time - {formatDate(previous.date, 'd MMM')}
            </span>
            <span className="tnum flex items-center gap-1.5 text-xs text-text-subtle">
              {previous.bestSet?.weightKg != null && previous.bestSet?.reps != null
                ? `best ${formatSet(previous.bestSet as never, exercise.trackingType, unit)}`
                : ''}
              {showPrevious ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
            </span>
          </button>
          {showPrevious ? (
            <ul className="space-y-1 px-3 pb-2.5 sm:px-4">
              {previous.sets.map((s) => (
                <li key={s.setNumber} className="tnum flex items-center justify-between text-xs text-text-muted">
                  <span className="text-text-subtle">Set {s.setNumber}{s.setType !== 'NORMAL' ? ` (${setTypeBadge(s.setType)})` : ''}</span>
                  <span>{formatSet(s, exercise.trackingType, unit)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Sets */}
      <ul className="space-y-1 p-2 sm:p-2.5">
        {exercise.sets.map((set) => (
          <li key={set.id}>
            <SetRow
              sessionId={sessionId}
              exercise={exercise}
              set={set}
              unit={unit}
              previous={previous?.sets.find((s) => s.setNumber === set.setNumber)}
            />
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t border-border px-3 py-2 sm:px-4">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Plus className="size-4" />}
          onClick={() => addSet.mutate()}
          isLoading={addSet.isPending}
        >
          Add set
        </Button>
        {exercise.notes ? (
          <p className="truncate text-xs text-text-subtle italic">"{exercise.notes}"</p>
        ) : null}
      </div>

      {/* Note editor - a plain prompt inside the card chrome. */}
      {noteOpen ? (
        <div className="border-t border-border bg-surface-inset/60 p-3 sm:p-4">
          <label htmlFor={`note-${exercise.id}`} className="mb-1.5 block text-xs font-medium text-text-muted">
            Note for {exercise.nameSnapshot}
          </label>
          <textarea
            id={`note-${exercise.id}`}
            rows={2}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder='e.g. "shoulder felt tight on set 3"'
            className="w-full resize-none rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { update.mutate({ notes: noteDraft.trim() || null }); setNoteOpen(false); }}>
              Save note
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
