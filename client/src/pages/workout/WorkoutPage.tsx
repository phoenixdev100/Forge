import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, Flag, Plus, SkipForward } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { qk, invalidateWorkoutData } from '@/lib/queryClient';
import type { WorkoutSession } from '@/lib/types';
import { toast } from 'sonner';
import { useUnit } from '@/providers/AuthProvider';
import { ExercisePicker } from '@/components/ExercisePicker';
import { SessionExerciseCard } from '@/components/workout/SessionExerciseCard';
import { RestTimerProvider } from '@/components/workout/RestTimer';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { ErrorState, PageLoader } from '@/components/ui/States';
import { formatWeight } from '@/lib/units';

/** Elapsed clock in the header - whole-session, not per-set. */
function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)));
  useEffect(() => {
    const interval = window.setInterval(
      () => setSeconds(Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [startedAt]);
  return <span className="tnum text-sm font-semibold text-text">{formatClock(seconds)}</span>;
}

export default function WorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unit = useUnit();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const scrollSentinel = useRef<HTMLDivElement>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.session(sessionId!),
    queryFn: () => api.get<{ session: WorkoutSession }>(`/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
    // During an active workout the cache is written optimistically per set.
    refetchInterval: false,
    staleTime: 0,
  });

  const addExercise = useMutation({
    mutationFn: (exerciseId: string) => api.post(`/sessions/${sessionId}/exercises`, { exerciseId, sets: 3 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.session(sessionId!) });
      // Scroll to the new exercise once it lands.
      window.setTimeout(() => scrollSentinel.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 150);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const complete = useMutation({
    mutationFn: (body: { durationSeconds: number; discardEmptySets: boolean }) =>
      api.post<{ session: WorkoutSession; personalRecords: unknown[] }>(`/sessions/${sessionId}/complete`, body),
    onSuccess: () => {
      invalidateWorkoutData();
      navigate(`/app/workout/${sessionId}/summary`, { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err, 'Unable to finish the workout. Please try again.')),
  });

  const abandon = useMutation({
    mutationFn: () => api.post(`/sessions/${sessionId}/abandon`),
    onSuccess: () => {
      invalidateWorkoutData();
      navigate('/app', { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // A completed session means the user navigated back - send them to the recap.
  useEffect(() => {
    if (data?.session.status === 'COMPLETED') {
      navigate(`/app/workout/${sessionId}/summary`, { replace: true });
    }
  }, [data?.session.status, navigate, sessionId]);

  const session = data?.session;

  const stats = useMemo(() => {
    if (!session) return { done: 0, total: 0, volume: 0 };
    let done = 0;
    let total = 0;
    let volume = 0;
    for (const e of session.exercises) {
      total += e.sets.length;
      done += e.progress.completedSets;
      volume += e.progress.volumeKg;
    }
    return { done, total, volume };
  }, [session]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <PageLoader label="Loading your workout" />
      </div>
    );
  }
  if (error || !session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
        <Link to="/app" className="text-sm font-medium text-accent hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const firstIncomplete = session.exercises.find((e) => !e.progress.isComplete && !e.isSkipped)?.id;

  return (
    <RestTimerProvider>
      <div className="min-h-dvh bg-bg pb-40">
        {/* Sticky workout header - always one glance at the clock + progress */}
        <header className="sticky top-0 z-30 border-b border-border bg-bg/95 pt-safe backdrop-blur-md">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link
              to="/app/today"
              aria-label="Minimise workout (sets are saved)"
              className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
            <div className="min-w-0 flex-1 text-center">
              <h1 className="truncate text-sm font-semibold text-text">{session.title}</h1>
              <p className="tnum text-[11px] text-text-subtle">
                {stats.done}/{stats.total} sets · {formatWeight(stats.volume, unit)}
              </p>
            </div>
            <ElapsedTime startedAt={session.startedAt} />
          </div>
          {/* Progress bar across the header bottom */}
          <div className="h-0.5 w-full bg-surface-inset" aria-hidden>
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }}
            />
          </div>
        </header>

        {/* Exercise nav - jump between exercises without scrolling */}
        {session.exercises.length > 1 ? (
          <nav aria-label="Exercises" className="scrollbar-none sticky top-14 z-20 flex gap-1.5 overflow-x-auto border-b border-border bg-bg/95 px-4 py-2.5 backdrop-blur-md">
            {session.exercises.map((e, i) => {
              const doneAll = e.progress.isComplete || e.isSkipped;
              const current = e.id === firstIncomplete;
              return (
                <a
                  key={e.id}
                  href={`#exercise-${e.id}`}
                  className={cn(
                    'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
                    doneAll
                      ? 'border-success/40 bg-success-soft text-success'
                      : current
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-border text-text-muted',
                  )}
                >
                  {doneAll ? <Check className="size-3" aria-hidden /> : null}
                  {e.isSkipped ? <SkipForward className="size-3" aria-hidden /> : null}
                  {i + 1}. {e.nameSnapshot}
                </a>
              );
            })}
          </nav>
        ) : null}

        <main className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-4 pb-28 lg:grid lg:max-w-6xl lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
          {session.exercises.map((exercise) => (
            <motion.section
              key={exercise.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <SessionExerciseCard
                sessionId={session.id}
                exercise={exercise}
                unit={unit}
                previous={session.previousPerformance[exercise.exercise.id]}
                isCurrent={exercise.id === firstIncomplete}
              />
            </motion.section>
          ))}

          {/* The plan is a starting point, not a contract. */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border-strong py-3 text-sm font-medium text-text-muted transition-colors hover:border-accent hover:text-accent lg:col-span-2"
          >
            <Plus className="size-4" aria-hidden />
            Add an exercise
          </button>
          <div ref={scrollSentinel} aria-hidden className="lg:col-span-2" />
        </main>

        {/* Sticky bottom bar - the action bar a thumb can reach */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-safe backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 lg:max-w-6xl">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-text-subtle"
              onClick={() => setAbandonOpen(true)}
            >
              End early
            </Button>
            <Button
              size="lg"
              onClick={() => setFinishOpen(true)}
              leftIcon={<Flag className="size-4" />}
              className="lg:h-10 lg:px-5"
            >
              Finish workout
            </Button>
          </div>
        </div>

        <ExercisePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          mode="single"
          title="Add exercise to this workout"
          excludeIds={session.exercises.map((e) => e.exercise.id)}
          onPick={(exercise) => addExercise.mutate(exercise.id)}
        />

        <ConfirmDialog
          open={finishOpen}
          onClose={() => setFinishOpen(false)}
          onConfirm={() =>
            complete.mutate({
              durationSeconds: Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)),
              discardEmptySets: true,
            })
          }
          isLoading={complete.isPending}
          title="Finish this workout?"
          description={
            stats.done < stats.total
              ? `${stats.total - stats.done} set${stats.total - stats.done === 1 ? ' is' : 's are'} still empty - blank sets are discarded, filled-in ones count as done.`
              : 'Every set is logged. This workout becomes part of your history.'
          }
          confirmLabel="Finish workout"
          tone="primary"
        />

        <ConfirmDialog
          open={abandonOpen}
          onClose={() => setAbandonOpen(false)}
          onConfirm={() => abandon.mutate()}
          isLoading={abandon.isPending}
          title="End this workout early?"
          description="The session is marked as abandoned. The sets you logged are kept in history but the workout won't count as completed."
          confirmLabel="End workout"
        />
      </div>
    </RestTimerProvider>
  );
}
