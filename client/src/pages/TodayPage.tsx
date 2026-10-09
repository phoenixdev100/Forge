import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarClock, Check, Dumbbell, ListChecks, Moon, Play, Plus, Repeat } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatDuration, formatRepRange } from '@/lib/format';
import { formatVolume, formatWeight } from '@/lib/units';
import { qk, invalidateWorkoutData } from '@/lib/queryClient';
import type { Plan, Schedule, WorkoutSession } from '@/lib/types';
import { toast } from 'sonner';
import { useUnit } from '@/providers/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { MuscleBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { ShiftForwardDialog } from '@/components/ShiftForwardDialog';

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoAddDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TodayPage() {
  const navigate = useNavigate();
  const unit = useUnit();
  const todayIso = isoToday();
  const [shiftOpen, setShiftOpen] = useState(false);

  const { data: schedule, isPending, error, refetch } = useQuery({
    queryKey: qk.schedule(todayIso, todayIso),
    queryFn: () => api.get<Schedule>('/schedule', { query: { from: todayIso, to: todayIso } }),
  });

  const { data: planData } = useQuery({
    queryKey: qk.activePlan,
    queryFn: () => api.get<{ plan: Plan | null }>('/plans/active'),
  });

  const cycleLength = planData?.plan?.cycleLength ?? 7;
  const tomorrowIso = isoAddDays(todayIso, 1);
  const aheadIso = isoAddDays(todayIso, cycleLength);

  // The next occurrences of every plan day - strictly future, so days that
  // already passed this week never show up as "train a different day".
  const { data: upcoming } = useQuery({
    queryKey: qk.schedule(tomorrowIso, aheadIso),
    queryFn: () => api.get<Schedule>('/schedule', { query: { from: tomorrowIso, to: aheadIso } }),
    enabled: Boolean(planData?.plan),
  });

  const upcomingDays = (upcoming?.entries ?? []).filter(
    (e) => e.scheduled && e.scheduled.dayType === 'WORKOUT',
  );

  const start = useMutation({
    mutationFn: (body: { planDayId?: string | null; blank?: boolean }) =>
      api.post<{ session: WorkoutSession }>('/sessions/start', body),
    onSuccess: ({ session }) => {
      invalidateWorkoutData();
      navigate(`/app/workout/${session.id}`);
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not start the workout.')),
  });

  if (isPending) return <PageLoader label="Loading today" />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const entry = schedule?.entries[0] ?? null;
  const scheduled = entry?.scheduled ?? null;
  const session = entry?.session ?? null;
  const planDay = scheduled?.planDayId
    ? planData?.plan?.days.find((d) => d.id === scheduled.planDayId) ?? null
    : null;

  return (
    <div>
      <PageHeader title="Today's workout" description={formatDate(todayIso, 'EEEE, d MMMM yyyy')} />

      {/* A session already running for today - resume is the only sane default. */}
      {session?.status === 'IN_PROGRESS' ? (
        <Card className="mb-4 overflow-hidden border-accent/40">
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex size-2.5 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
              </span>
              <div>
                <p className="text-xs font-medium tracking-wide text-text-subtle uppercase">In progress</p>
                <h2 className="mt-0.5 text-base font-semibold text-text">{session.title}</h2>
                <p className="mt-0.5 text-sm text-text-muted">
                  {session.totalSets} sets logged so far
                </p>
              </div>
            </div>
            <Button onClick={() => navigate(`/app/workout/${session.id}`)} leftIcon={<Play className="size-4" />}>
              Resume
            </Button>
          </CardBody>
        </Card>
      ) : session?.status === 'COMPLETED' ? (
        <Card className="mb-4">
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="size-4" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">{session.title} - done</h2>
                <p className="mt-0.5 text-sm text-text-muted">
                  {formatDuration(session.durationSeconds)} · {session.totalSets} sets
                  {session.totalVolumeKg ? ` · ${formatVolume(session.totalVolumeKg, unit)}` : ''}
                  {session.prCount ? ` · ${session.prCount} PR${session.prCount === 1 ? '' : 's'}` : ''}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <ButtonLink variant="secondary" size="sm" to={`/app/history/${session.id}`}>View session</ButtonLink>
              <Button
                variant="secondary"
                size="sm"
                isLoading={start.isPending}
                onClick={() => start.mutate({ blank: true })}
                leftIcon={<Plus className="size-4" />}
              >
                Train again
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : scheduled && scheduled.dayType !== 'REST' ? (
        <Card className="mb-4 overflow-hidden">
          <div className="border-b border-border bg-accent-soft px-4 py-2 text-xs font-medium tracking-wide text-accent uppercase">
            Scheduled for today
          </div>
          <CardBody className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-text">{scheduled.label}</h2>
                {scheduled.muscleGroups.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {scheduled.muscleGroups.map((m) => (
                      <MuscleBadge key={m.id} name={m.name} colorHex={m.colorHex} size="sm" />
                    ))}
                  </div>
                ) : null}
                <p className="mt-1.5 text-sm text-text-muted">
                  {scheduled.exerciseCount} exercise{scheduled.exerciseCount === 1 ? '' : 's'}
                  {scheduled.estimatedMinutes ? ` · ~${scheduled.estimatedMinutes} minutes` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <Button
                  size="md"
                  isLoading={start.isPending}
                  onClick={() => start.mutate({ planDayId: scheduled.planDayId })}
                  leftIcon={<Play className="size-4" />}
                >
                  Start workout
                </Button>
                <button
                  type="button"
                  onClick={() => setShiftOpen(true)}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium text-text-subtle transition-colors hover:text-text"
                >
                  <CalendarClock className="size-3.5" aria-hidden /> Can't today? Shift week forward
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card className="mb-4">
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-inset text-text-subtle">
                {scheduled?.dayType === 'REST' || entry?.state === 'rest' ? (
                  <Moon className="size-4" aria-hidden />
                ) : (
                  <Dumbbell className="size-4" aria-hidden />
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">
                  {entry?.state === 'rest' ? 'Rest day' : 'Nothing scheduled'}
                </h2>
                <p className="mt-0.5 text-sm text-text-muted">
                  {entry?.state === 'rest'
                    ? 'Recovery is part of the plan - your streak keeps counting.'
                    : 'Start a blank session, or pick any day from your plan.'}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              isLoading={start.isPending}
              onClick={() => start.mutate({ blank: true })}
              leftIcon={<Dumbbell className="size-4" />}
            >
              Start blank workout
            </Button>
          </CardBody>
        </Card>
      )}

      {/* The workout preview - exactly what is about to happen. */}
      {planDay && session?.status !== 'COMPLETED' ? (
        <Card>
          <CardHeader
            title="What's planned"
            description="Every target is a starting point - change anything during the workout."
            icon={<ListChecks className="size-4" />}
          />
          <CardBody className="p-4">
            {planDay.exercises.length ? (
              <ul className="space-y-1.5">
                {planDay.exercises.map((pe, i) => (
                  <li key={pe.id} className="flex items-center gap-3 rounded-[var(--radius-control)] bg-surface-inset px-3 py-2">
                    <span className="tnum w-5 shrink-0 text-center text-xs font-semibold text-text-subtle">{i + 1}</span>
                    <ExerciseMedia media={pe.exercise.media} name={pe.exercise.name} mode="thumb" className="size-9 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{pe.exercise.name}</p>
                      <p className="tnum mt-0.5 text-xs text-text-subtle">
                        {[
                          pe.targetSets ? `${pe.targetSets} sets` : null,
                          formatRepRange(pe.targetRepsMin, pe.targetRepsMax) !== '-' ? `${formatRepRange(pe.targetRepsMin, pe.targetRepsMax)} reps` : null,
                          pe.targetWeightKg != null ? formatWeight(pe.targetWeightKg, unit) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Flexible'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Dumbbell className="size-5" />}
                title="This day has no exercises yet"
                description="Add exercises to the plan, or start the workout and add them as you go."
                action={planData?.plan?.id ? <ButtonLink variant="secondary" size="sm" to={`/app/plans/${planData.plan.id}`}>Edit plan</ButtonLink> : undefined}
              />
            )}
          </CardBody>
        </Card>
      ) : null}

      {/* Upcoming days from the active plan - pull a future workout into today. */}
      {planData?.plan && upcomingDays.length ? (
        <Card className="mt-4">
          <CardHeader title="Train a different day" description={`Upcoming in ${planData.plan.name}`} icon={<Repeat className="size-4" />} />
          <CardBody className="p-4">
            <ul className="divide-y divide-border">
              {upcomingDays.map((e) => {
                const day = e.scheduled!;
                return (
                  <li key={e.date} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">{day.label}</p>
                      <p className="mt-0.5 text-xs text-text-subtle">
                        {formatDate(e.date, 'EEE, d MMM')} · {day.exerciseCount} exercise{day.exerciseCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={start.isPending}
                      onClick={() => start.mutate({ planDayId: day.planDayId })}
                      leftIcon={<Play className="size-3.5" />}
                    >
                      Start
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <ShiftForwardDialog date={todayIso} open={shiftOpen} onClose={() => setShiftOpen(false)} />

      {!planData?.plan && !session ? (
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="No active plan"
          description="A plan fills today with the right workout automatically. Create one, or just start blank."
          action={<ButtonLink to="/app/plans" leftIcon={<ListChecks className="size-4" />}>Create a plan</ButtonLink>}
          secondaryAction={
            <Button variant="secondary" isLoading={start.isPending} onClick={() => start.mutate({ blank: true })}>
              Start blank workout
            </Button>
          }
          className="mt-4"
        />
      ) : null}
    </div>
  );
}
