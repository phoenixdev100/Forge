import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Dumbbell, GitCompareArrows, Pencil, Repeat, RotateCcw, Share2, Timer, Trash2, Trophy } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';
import { setTypeBadge, tracksReps, tracksWeight } from '@/lib/tracking';
import { formatVolume, formatWeight } from '@/lib/units';
import { qk, invalidateWorkoutData } from '@/lib/queryClient';
import type { WorkoutSession } from '@/lib/types';
import { toast } from 'sonner';
import { useUnit } from '@/providers/AuthProvider';
import { shareWorkoutCard } from '@/lib/shareWorkout';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { SessionCompareDialog } from '@/components/history/SessionCompareDialog';
import { Badge, MuscleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, StatTile } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States';
import { cn } from '@/lib/cn';

const STATUS_LABEL = { COMPLETED: 'Completed', IN_PROGRESS: 'In progress', ABANDONED: 'Ended early' } as const;
const STATUS_TONE = { COMPLETED: 'success', IN_PROGRESS: 'accent', ABANDONED: 'neutral' } as const;

/**
 * The read view of a finished session. Editing is one explicit action - the
 * workout reopens, you change what happened, and finishing saves it again.
 */
export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unit = useUnit();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.session(sessionId!),
    queryFn: () => api.get<{ session: WorkoutSession }>(`/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/sessions/${sessionId}`),
    onSuccess: () => {
      invalidateWorkoutData();
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Workout deleted from your history.');
      navigate('/app/history', { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const reopen = useMutation({
    mutationFn: () => api.post<{ session: WorkoutSession }>(`/sessions/${sessionId}/reopen`),
    onSuccess: () => {
      invalidateWorkoutData();
      navigate(`/app/workout/${sessionId}`, { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const repeat = useMutation({
    mutationFn: () => api.post<{ session: WorkoutSession }>(`/sessions/${sessionId}/repeat`),
    onSuccess: ({ session: fresh }) => {
      invalidateWorkoutData();
      navigate(`/app/workout/${fresh.id}`, { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  async function share() {
    if (!data) return;
    setSharing(true);
    try {
      const how = await shareWorkoutCard(data.session, unit);
      toast.success(how === 'shared' ? 'Shared.' : 'Card image downloaded.');
    } catch (err) {
      // The user backing out of the share sheet is not an error.
      if (err instanceof Error && err.name === 'AbortError') return;
      toast.error(errorMessage(err));
    } finally {
      setSharing(false);
    }
  }

  if (isPending) return <PageLoader label="Loading workout" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const session = data.session;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link to="/app/history" className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> History
        </Link>
        {session.status === 'IN_PROGRESS' ? (
          <Button size="sm" onClick={() => navigate(`/app/workout/${session.id}`)}>Resume workout</Button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {session.status === 'COMPLETED' ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RotateCcw className="size-3.5" />}
                  isLoading={repeat.isPending}
                  onClick={() => repeat.mutate()}
                >
                  Repeat
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<GitCompareArrows className="size-3.5" />}
                  onClick={() => setCompareOpen(true)}
                >
                  Compare
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Share2 className="size-3.5" />}
                  isLoading={sharing}
                  onClick={() => void share()}
                >
                  Share
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
              </>
            ) : null}
            <Button variant="ghost" size="icon" aria-label="Delete workout" className="text-text-subtle hover:text-danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-text">{session.title}</h1>
          <Badge tone={STATUS_TONE[session.status]}>{STATUS_LABEL[session.status]}</Badge>
          {session.prCount ? (
            <Badge tone="accent">
              <Trophy className="size-3.5" aria-hidden /> {session.prCount} PR{session.prCount === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm text-text-muted">{formatDate(session.date, 'EEEE, d MMMM yyyy')}</p>
        {session.muscleGroups.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {session.muscleGroups.map((m) => (
              <MuscleBadge key={m.id} name={m.name} colorHex={m.colorHex} size="sm" />
            ))}
          </div>
        ) : null}
      </div>

      {/* Headline numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Duration" value={formatDuration(session.durationSeconds)} icon={<Timer className="size-4" />} />
        <StatTile label="Exercises" value={session.summary.completedExerciseCount} icon={<Dumbbell className="size-4" />} />
        <StatTile label="Sets" value={session.summary.completedSetCount} icon={<Repeat className="size-4" />} />
        <StatTile label="Volume" value={formatVolume(session.totalVolumeKg, unit)} />
      </div>

      {session.notes ? (
        <Card className="mb-6">
          <CardBody>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-text-muted">"{session.notes}"</p>
          </CardBody>
        </Card>
      ) : null}

      {/* Per-exercise, per-set - the full receipt */}
      <div className="space-y-4">
        {session.exercises.map((exercise) => {
          const logged = exercise.sets.filter((s) => s.isCompleted);
          return (
            <Card key={exercise.id}>
              <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
                <ExerciseMedia media={exercise.exercise.media} name={exercise.nameSnapshot} mode="thumb" className="size-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-semibold', exercise.isSkipped ? 'text-text-subtle line-through' : 'text-text')}>
                    {exercise.nameSnapshot}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {exercise.isSkipped
                      ? 'Skipped'
                      : `${logged.length} of ${exercise.sets.length} sets · ${formatWeight(exercise.progress.volumeKg, unit)}`}
                  </p>
                </div>
                <Link
                  to={`/app/exercises/${exercise.exercise.slug}`}
                  className="shrink-0 text-xs font-medium text-accent hover:underline"
                >
                  Exercise →
                </Link>
              </div>
              {logged.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-semibold tracking-wide text-text-subtle uppercase">
                        <th className="px-4 py-2 sm:px-5">Set</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2 text-right">Weight</th>
                        <th className="px-4 py-2 text-right">Reps</th>
                        <th className="hidden px-4 py-2 text-right sm:table-cell">Volume</th>
                        <th className="hidden px-4 py-2 text-right sm:table-cell">e1RM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercise.sets.map((set) => (
                        <tr key={set.id} className={cn('border-b border-border last:border-0', !set.isCompleted && 'opacity-40')}>
                          <td className="tnum px-4 py-2 sm:px-5">{set.setNumber}</td>
                          <td className="px-4 py-2 text-xs text-text-subtle">{setTypeBadge(set.setType) ?? 'Working'}</td>
                          <td className="tnum px-4 py-2 text-right">
                            {tracksWeight(exercise.trackingType) ? formatWeight(set.weightKg, unit) : '-'}
                          </td>
                          <td className="tnum px-4 py-2 text-right">
                            {tracksReps(exercise.trackingType) ? (set.reps ?? '-') : set.timeSeconds != null ? `${set.timeSeconds}s` : '-'}
                          </td>
                          <td className="tnum hidden px-4 py-2 text-right sm:table-cell">
                            {set.volumeKg != null ? formatWeight(set.volumeKg, unit) : '-'}
                          </td>
                          <td className="tnum hidden px-4 py-2 text-right sm:table-cell">
                            {set.estimatedOneRmKg != null ? formatWeight(set.estimatedOneRmKg, unit) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-4 py-3 text-xs text-text-subtle sm:px-5">
                  {exercise.isSkipped ? 'Skipped during the workout.' : 'No sets completed.'}
                </p>
              )}
              {exercise.notes ? (
                <p className="border-t border-border px-4 py-2.5 text-xs text-text-subtle italic sm:px-5">
                  "{exercise.notes}"
                </p>
              ) : null}
            </Card>
          );
        })}

        {!session.exercises.length ? (
          <EmptyState icon={<Dumbbell className="size-5" />} title="No exercises logged" description="This session was saved without any completed exercises." />
        ) : null}
      </div>

      <ConfirmDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onConfirm={() => reopen.mutate()}
        isLoading={reopen.isPending}
        title="Edit this workout?"
        description="The workout reopens so you can fix sets, weights or exercises. Finish it again to save - totals and personal records are recalculated."
        confirmLabel="Edit workout"
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
        isLoading={remove.isPending}
        title="Delete this workout?"
        description="This removes the session and its PRs from your history. This cannot be undone."
        confirmLabel="Delete workout"
      />
      <SessionCompareDialog open={compareOpen} onClose={() => setCompareOpen(false)} session={session} />
    </div>
  );
}
