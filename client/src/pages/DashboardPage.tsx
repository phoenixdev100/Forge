import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  ListChecks,
  Moon,
  Play,
  Plus,
  Trophy,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatRelativeDay, isLiftRecord, PR_TYPE_LABELS } from '@/lib/format';
import { formatVolume, formatWeight } from '@/lib/units';
import { qk, invalidateWorkoutData } from '@/lib/queryClient';
import type { Dashboard, ScheduleEntry, WorkoutSession } from '@/lib/types';
import { toast } from 'sonner';
import { useAuth, useUnit } from '@/providers/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, MuscleBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, StatTile } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The hero card: what the user came here to do. */
function TodayCard({ today, activeSession }: { today: ScheduleEntry | null; activeSession: Dashboard['activeSession'] }) {
  const navigate = useNavigate();
  const start = useMutation({
    mutationFn: (body: { planDayId?: string | null; blank?: boolean }) =>
      api.post<{ session: WorkoutSession }>('/sessions/start', body),
    onSuccess: ({ session }) => {
      invalidateWorkoutData();
      navigate(`/app/workout/${session.id}`);
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not start the workout.')),
  });

  // An in-progress session always wins - resuming is the primary action.
  if (activeSession) {
    return (
      <Card className="overflow-hidden border-accent/40">
        <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="relative flex size-3 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex size-3 rounded-full bg-accent" />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-text-subtle uppercase">Workout in progress</p>
              <h2 className="mt-0.5 text-lg font-semibold text-text">{activeSession.title}</h2>
            </div>
          </div>
          <Button size="md" onClick={() => navigate(`/app/workout/${activeSession.id}`)} leftIcon={<Play className="size-4" />}>
            Resume workout
          </Button>
        </CardBody>
      </Card>
    );
  }

  const scheduled = today?.scheduled;

  // Rest day - encourage, don't push.
  if (today && (today.state === 'rest' || scheduled?.dayType === 'REST')) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-inset text-text-subtle">
              <Moon className="size-4" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-text-subtle uppercase">Today · {formatDate(today.date, 'EEEE d MMM')}</p>
              <h2 className="mt-0.5 text-base font-semibold text-text">Rest day - recover well</h2>
              <p className="mt-0.5 text-sm text-text-muted">Your streak counts rest days. Feeling fresh anyway?</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            isLoading={start.isPending}
            onClick={() => start.mutate({ blank: true })}
            leftIcon={<Dumbbell className="size-4" />}
          >
            Train anyway
          </Button>
        </CardBody>
      </Card>
    );
  }

  // A scheduled workout today.
  if (scheduled) {
    return (
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-accent-soft px-4 py-2 text-xs font-medium tracking-wide text-accent uppercase">
          Today's workout
        </div>
        <CardBody className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-text">{scheduled.label}</h2>
              {scheduled.muscleGroups.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {scheduled.muscleGroups.map((m) => (
                    <MuscleBadge key={m.id} name={m.name} colorHex={m.colorHex} size="sm" />
                  ))}
                </div>
              ) : null}
              <p className="mt-2 text-sm text-text-muted">
                {scheduled.exerciseCount} exercise{scheduled.exerciseCount === 1 ? '' : 's'}
                {scheduled.estimatedMinutes ? ` · ~${scheduled.estimatedMinutes} min` : ''}
              </p>
            </div>
            <Button
              size="md"
              className="sm:w-auto"
              isLoading={start.isPending}
              onClick={() => start.mutate({ planDayId: scheduled.planDayId })}
              leftIcon={<Play className="size-4" />}
            >
              Start workout
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // A completed session exists for today.
  if (today?.session?.status === 'COMPLETED') {
    return (
      <Card>
        <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <Check className="size-4" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-text-subtle uppercase">Today's workout</p>
              <h2 className="mt-0.5 text-base font-semibold text-text">{today.session.title} - done</h2>
              <p className="mt-0.5 text-sm text-text-muted">
                {today.session.totalSets} sets
                {today.session.totalVolumeKg ? ` · ${formatVolume(today.session.totalVolumeKg, 'KG')}` : ''}
                {today.session.prCount ? ` · ${today.session.prCount} PR${today.session.prCount === 1 ? '' : 's'}` : ''}
              </p>
            </div>
          </div>
          <ButtonLink variant="secondary" to={`/app/history/${today.session.id}`}>
            View session
          </ButtonLink>
        </CardBody>
      </Card>
    );
  }

  // Plan exists but nothing scheduled today - or no plan at all.
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-text-subtle uppercase">Today · {formatDate(new Date().toISOString(), 'EEEE d MMM')}</p>
          <h2 className="mt-0.5 text-base font-semibold text-text">Nothing scheduled today</h2>
          <p className="mt-0.5 text-sm text-text-muted">Start a blank workout, or build a plan so today fills itself in.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="secondary"
            isLoading={start.isPending}
            onClick={() => start.mutate({ blank: true })}
            leftIcon={<Dumbbell className="size-4" />}
          >
            Blank workout
          </Button>
          <ButtonLink to="/app/plans" leftIcon={<ListChecks className="size-4" />}>
            Create a plan
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}

function WeeklyStrip({ days }: { days: Dashboard['weeklyActivity'] }) {
  const maxVolume = Math.max(1, ...days.map((d) => d.volumeKg));
  return (
    <Card>
      <CardHeader title="This week" description="Training days so far" icon={<CalendarDays className="size-4" />} />
      <CardBody className="p-4">
        <div className="flex items-end justify-between gap-2">
          {days.map((day) => {
            const trained = day.workouts > 0;
            const isToday = formatRelativeDay(day.date) === 'Today';
            return (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-14 w-full items-end justify-center">
                  <div
                    className={cn(
                      'w-full max-w-7 rounded-md transition-colors',
                      trained ? 'bg-accent' : 'bg-surface-inset',
                      isToday && !trained && 'border border-dashed border-border-strong',
                    )}
                    style={{ height: trained ? `${Math.max(18, (day.volumeKg / maxVolume) * 100)}%` : '18%' }}
                    title={trained ? day.titles.join(', ') : 'No workout'}
                  />
                </div>
                <span className={cn('text-[10px] font-medium', isToday ? 'text-accent' : 'text-text-subtle')}>
                  {formatDate(day.date, 'EEEEE')}
                </span>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const unit = useUnit();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api.get<Dashboard>('/dashboard'),
  });

  if (isPending) {
    return (
      <div className="space-y-5" aria-label="Loading dashboard">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { today, upcoming, activeSession, streak, totals, weeklyActivity, recentPersonalRecords, plan, state } = data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting()}, ${user?.name.split(' ')[0] ?? 'there'}`}
        description={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        action={
          streak.current > 0 ? (
            <Badge tone="accent" className="gap-1.5">
              <Flame className="size-3.5" aria-hidden />
              {streak.current}-day streak
            </Badge>
          ) : undefined
        }
      />

      {/* First-run guidance: no plan yet is the single most important state. */}
      {!state.hasPlan ? (
        <Card className="border-accent/40 bg-accent-soft/40">
          <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">Set up your training week</h2>
              <p className="mt-1 max-w-lg text-sm text-text-muted">
                Create a plan with your days, muscle groups and exercises - or start from a template and make it yours.
                You can also just start a blank workout right now.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ButtonLink to="/app/plans" leftIcon={<Plus className="size-4" />}>Create a plan</ButtonLink>
              <ButtonLink variant="outline" to="/app/today">Start blank workout</ButtonLink>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <TodayCard today={today} activeSession={activeSession} />

      {/* Glanceable stats - only what answers "how am I doing". */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="This week"
          value={totals.thisWeek.workouts}
          sub={`${formatVolume(totals.thisWeek.volumeKg, unit)} total volume`}
          title="Total volume = weight × reps across all working sets"
        />
        <StatTile label="Workouts" value={totals.totalWorkouts} sub="all time" />
        <StatTile
          label="Volume"
          value={formatVolume(totals.totalVolumeKg, unit)}
          sub="all time"
          title="Total volume = weight × reps across all working sets"
        />
        <StatTile
          label="Streak"
          value={`${streak.current}d`}
          sub={streak.longest > streak.current ? `best ${streak.longest}d` : 'personal best'}
          tone="accent"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <WeeklyStrip days={weeklyActivity} />

          {/* Upcoming */}
          <Card>
            <CardHeader title="Coming up" description={plan ? `From ${plan.name}` : 'Schedule'} icon={<CalendarDays className="size-4" />} />
            <CardBody className="p-4">
              {upcoming.length ? (
                <ul className="divide-y divide-border">
                  {upcoming.map((entry) => (
                    <li key={entry.date}>
                      <Link
                        to="/app/calendar"
                        className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-surface-inset">
                          <span className="tnum text-sm font-semibold leading-none text-text">
                            {formatDate(entry.date, 'd')}
                          </span>
                          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-text-subtle">
                            {formatDate(entry.date, 'MMM')}
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">
                            {entry.scheduled?.label ?? 'Workout'}
                          </p>
                          <p className="truncate text-xs text-text-subtle">
                            {formatRelativeDay(entry.date)}
                            {entry.scheduled?.exerciseCount ? ` · ${entry.scheduled.exerciseCount} exercises` : ''}
                            {entry.scheduled?.estimatedMinutes ? ` · ~${entry.scheduled.estimatedMinutes} min` : ''}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">
                  {plan ? 'The next few days are rest or unscheduled.' : 'Create a plan to see your week here.'}
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Recent PRs */}
        <Card className="flex flex-col">
          <CardHeader
            title="Recent records"
            icon={<Trophy className="size-4" />}
            action={
              <Link to="/app/records" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                All <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
          <CardBody className="flex flex-1 flex-col p-4">
            {recentPersonalRecords.filter(isLiftRecord).length ? (
              <ul className="divide-y divide-border">
                {recentPersonalRecords.filter(isLiftRecord).map((pr) => (
                  <li key={pr.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                    <Trophy className="size-3.5 shrink-0 text-accent" aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium text-text">{pr.exercise.name}</span>
                      <span className="text-text-subtle">
                        {' '}{PR_TYPE_LABELS[pr.type] ?? pr.type}
                        {pr.previousValue != null
                          ? ` · was ${
                              pr.type === 'MAX_REPS'
                                ? `${pr.previousValue} reps`
                                : pr.type === 'BEST_TIME'
                                  ? `${pr.previousValue}s`
                                  : pr.type === 'BEST_DISTANCE'
                                    ? `${pr.previousValue}m`
                                    : formatWeight(pr.previousValue, unit)
                            }`
                          : ''}
                      </span>
                    </p>
                    <span className="tnum shrink-0 text-sm font-semibold text-text">
                      {pr.type === 'MAX_REPS'
                        ? `${pr.value} reps`
                        : pr.type === 'BEST_TIME'
                          ? `${pr.value}s`
                          : pr.type === 'BEST_DISTANCE'
                            ? `${pr.value}m`
                            : formatWeight(pr.value, unit)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Trophy className="size-5" />}
                title="No records yet"
                description={
                  state.hasTrained
                    ? 'Beat a previous best and it lands here automatically.'
                    : 'Finish your first workout and your personal records start building from there.'
                }
                className="flex-1 border-none bg-transparent py-8"
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
