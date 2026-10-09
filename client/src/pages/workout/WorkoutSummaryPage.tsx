import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, Dumbbell, Flame, Home, Repeat, Timer, Trophy } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';
import { formatSet } from '@/lib/tracking';
import { formatVolume } from '@/lib/units';
import { qk } from '@/lib/queryClient';
import type { WorkoutSession } from '@/lib/types';
import { toast } from 'sonner';
import { useUnit } from '@/providers/AuthProvider';
import { MuscleBadge, Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, StatTile } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { ErrorState, PageLoader } from '@/components/ui/States';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';

const FEELINGS = [
  { value: 1, label: 'Rough' },
  { value: 2, label: 'Tough' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];

/**
 * The post-workout recap. PRs get the moment they deserve; everything else is
 * a compact receipt the user can skim between sets of their day.
 */
export default function WorkoutSummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const unit = useUnit();
  const [notes, setNotes] = useState<string | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.session(sessionId!),
    queryFn: () => api.get<{ session: WorkoutSession }>(`/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const saveMeta = useMutation({
    mutationFn: (body: { notes?: string | null; feeling?: number | null }) =>
      api.patch(`/sessions/${sessionId}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.session(sessionId!) });
      setSaved(true);
      toast.success('Notes saved to this workout.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <PageLoader label="Loading your summary" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
        <ButtonLink to="/app">Back to dashboard</ButtonLink>
      </div>
    );
  }

  const session = data.session;
  const completed = session.status === 'COMPLETED';
  const prCount = session.prCount;

  return (
    <div className="min-h-dvh bg-bg pb-16">
      <header className="border-b border-border bg-bg/95 pt-safe">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
          <Link to="/app" className="flex items-center gap-2">
            <Logo className="size-6" />
            <span className="text-sm font-semibold text-text">Forge</span>
          </Link>
          <ButtonLink variant="ghost" size="sm" to="/app" leftIcon={<Home className="size-4" />}>
            Done
          </ButtonLink>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pt-8">
        {/* The moment */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}
            className={cn(
              'mx-auto flex size-16 items-center justify-center rounded-full',
              completed ? 'bg-success-soft text-success' : 'bg-surface-inset text-text-subtle',
            )}
          >
            <CheckCircle2 className="size-8" aria-hidden />
          </motion.div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-text sm:text-3xl">
            {completed ? 'Workout complete' : 'Workout ended'}
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            {session.title} · {formatDate(session.date, 'EEEE d MMM')}
          </p>
          {session.muscleGroups.length ? (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {session.muscleGroups.map((m) => (
                <MuscleBadge key={m.id} name={m.name} colorHex={m.colorHex} size="sm" />
              ))}
            </div>
          ) : null}
        </motion.div>

        {/* Numbers */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatTile label="Duration" value={formatDuration(session.durationSeconds)} icon={<Timer className="size-4" />} />
          <StatTile label="Exercises" value={session.summary.completedExerciseCount} icon={<Dumbbell className="size-4" />} />
          <StatTile label="Sets" value={session.summary.completedSetCount} icon={<Repeat className="size-4" />} />
          <StatTile label="Volume" value={formatVolume(session.totalVolumeKg, unit)} icon={<Flame className="size-4" />} />
        </motion.div>

        {/* PRs - the reason to look at this screen */}
        {prCount > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.35 }}
          >
            <Card className="mt-6 border-accent/40 bg-accent-soft/30">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Trophy className="size-4 text-accent" aria-hidden />
                    {prCount} personal record{prCount === 1 ? '' : 's'}
                  </span>
                }
                description="New bests from this session - your history just got heavier."
              />
              <CardBody className="pt-4">
                <ul className="space-y-2.5">
                  {session.exercises
                    .filter((e) => e.progress.completedSets > 0)
                    .map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-surface px-3 py-2.5">
                        <span className="truncate text-sm font-medium text-text">{e.nameSnapshot}</span>
                        <Badge tone="accent" size="sm">PR</Badge>
                      </li>
                    ))}
                </ul>
              </CardBody>
            </Card>
          </motion.div>
        ) : null}

        {/* What you did - the full set-by-set receipt */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.45 }}
          className="mt-6"
        >
          <Card>
            <CardHeader title="The session" description="Every set, as logged" />
            <CardBody className="space-y-4 pt-4">
              {session.exercises.map((e) => (
                <div key={e.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-sm font-medium', e.isSkipped ? 'text-text-subtle line-through' : 'text-text')}>
                      {e.nameSnapshot}
                    </p>
                    {e.isSkipped ? <Badge size="sm">Skipped</Badge> : null}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {e.sets
                      .filter((s) => s.isCompleted)
                      .map((s) => (
                        <li key={s.id} className="tnum flex items-center justify-between text-xs text-text-muted">
                          <span className="text-text-subtle">Set {s.setNumber}</span>
                          <span>{formatSet(s, e.trackingType, unit)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </CardBody>
          </Card>
        </motion.div>

        {/* How it felt + a note - optional, collapsible into the flow */}
        {!saved ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.55 }}
            className="mt-6"
          >
            <Card>
              <CardBody>
                <p className="mb-3 text-sm font-medium text-text">How did it feel?</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {FEELINGS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFeeling(f.value)}
                      aria-pressed={feeling === f.value}
                      className={cn(
                        'h-10 rounded-[var(--radius-control)] border text-xs font-medium transition-colors',
                        feeling === f.value
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-border text-text-muted hover:border-border-strong',
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  label="Workout note (optional)"
                  containerClassName="mt-4"
                  value={notes ?? session.notes ?? ''}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Felt strong today. Next time: add 2.5 kg to the top set."
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  isLoading={saveMeta.isPending}
                  disabled={feeling === null && (notes === null || !notes.trim())}
                  onClick={() => saveMeta.mutate({ notes: notes ?? undefined, feeling })}
                >
                  Save to workout
                </Button>
              </CardBody>
            </Card>
          </motion.div>
        ) : null}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <ButtonLink size="lg" fullWidth to="/app" leftIcon={<Home className="size-4" />}>
            Back to dashboard
          </ButtonLink>
          <ButtonLink variant="secondary" size="lg" fullWidth to="/app/history" state={undefined}>
            View history
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
