import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, CalendarClock, ChevronLeft, ChevronRight, CircleOff, Dumbbell, Moon, PencilLine, Play, Repeat, RotateCcw } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatDuration } from '@/lib/format';
import { formatVolume } from '@/lib/units';
import { qk, invalidateWorkoutData } from '@/lib/queryClient';
import type { Plan, Schedule, ScheduleEntry, WorkoutSession } from '@/lib/types';
import { toast } from 'sonner';
import { useUnit } from '@/providers/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, MuscleBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { ErrorState, PageLoader } from '@/components/ui/States';
import { ShiftForwardDialog } from '@/components/ShiftForwardDialog';

type CellState = ScheduleEntry['state'];

const STATE_STYLE: Record<CellState, string> = {
  completed: 'bg-success-soft text-success',
  in_progress: 'bg-accent-soft text-accent',
  partial: 'bg-info-soft text-info',
  missed: 'bg-danger-soft text-danger',
  rest: 'bg-surface-inset text-text-subtle',
  scheduled: 'bg-surface-inset text-text-muted',
  empty: 'text-text-subtle',
};

const STATE_LABEL: Record<CellState, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  partial: 'Partially done',
  missed: 'Missed',
  rest: 'Rest day',
  scheduled: 'Scheduled',
  empty: 'Nothing planned',
};

/* ------------------------------------------------------------------ */
/* Day detail sheet - the session that happened, or the plan to do      */
/* ------------------------------------------------------------------ */

function DaySheet({
  entry,
  onClose,
}: {
  entry: ScheduleEntry;
  onClose: () => void;
}) {
  const unit = useUnit();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [overrideDayId, setOverrideDayId] = useState<string | null>(entry.scheduled?.planDayId ?? null);
  const [note, setNote] = useState(entry.overrideNote ?? '');
  const [mode, setMode] = useState<'rest' | 'swap' | 'clear'>(() => {
    if (entry.isOverride) return entry.scheduled ? 'swap' : 'rest';
    return 'rest';
  });
  const [confirmShift, setConfirmShift] = useState(false);

  const QUICK_REASONS = ['Gym closed', 'Festival', 'Sick', 'Travel', 'Busy day'];

  const { data: planData } = useQuery({
    queryKey: qk.activePlan,
    queryFn: () => api.get<{ plan: Plan | null }>('/plans/active'),
    enabled: editing,
  });
  const workoutDays = (planData?.plan?.days ?? []).filter((d) => d.dayType === 'WORKOUT');

  const start = useMutation({
    mutationFn: (body: { date: string; planDayId?: string | null; blank?: boolean }) =>
      api.post<{ session: WorkoutSession }>('/sessions/start', body),
    onSuccess: ({ session }) => {
      invalidateWorkoutData();
      onClose();
      navigate(`/app/workout/${session.id}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const setOverride = useMutation({
    mutationFn: (body: { planDayId?: string | null; isRest?: boolean; note?: string | null }) =>
      api.put(`/schedule/${entry.date}/override`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
      void queryClient.invalidateQueries({ queryKey: qk.dashboard });
      toast.success(`${formatDate(entry.date, 'd MMM')} updated - the recurring plan is unchanged.`);
      setEditing(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const clearOverride = useMutation({
    mutationFn: () => api.delete(`/schedule/${entry.date}/override`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
      toast.success('Back to the recurring schedule.');
      setEditing(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const session = entry.session;
  // A day with nothing on it shouldn't be a dead end - land straight on the
  // mark options instead of hiding them behind "Change this date".
  const isEmptyDay = entry.state === 'empty' && !session;
  const showMarkPanel = editing || isEmptyDay;

  return (
    <Dialog open onClose={onClose} title={formatDate(entry.date, 'EEEE, d MMMM')} variant="sheet" size="md">
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Badge tone={entry.state === 'completed' ? 'success' : entry.state === 'missed' ? 'danger' : 'neutral'}>
            {STATE_LABEL[entry.state]}
          </Badge>
          {entry.isOverride ? <Badge tone="info">Edited just for this date</Badge> : null}
          {entry.overrideNote ? <Badge tone="warning">{entry.overrideNote}</Badge> : null}
          {entry.isToday ? <Badge tone="accent">Today</Badge> : null}
        </div>

        {/* The completed session - what actually happened */}
        {session ? (
          <div className="rounded-[var(--radius-card)] border border-border bg-surface-inset p-4">
            <p className="text-sm font-semibold text-text">{session.title}</p>
            <p className="tnum mt-1.5 text-xs text-text-muted">
              {session.exerciseCount} exercises · {session.totalSets} sets
              {session.durationSeconds ? ` · ${formatDuration(session.durationSeconds)}` : ''}
              {session.totalVolumeKg ? ` · ${formatVolume(session.totalVolumeKg, unit)}` : ''}
            </p>
            <div className="mt-3 flex gap-2">
              {session.status === 'IN_PROGRESS' ? (
                <Button size="sm" onClick={() => navigate(`/app/workout/${session.id}`)} leftIcon={<Play className="size-3.5" />}>
                  Resume
                </Button>
              ) : (
                <ButtonLink size="sm" variant="secondary" to={`/app/history/${session.id}`}>
                  View session
                </ButtonLink>
              )}
            </div>
          </div>
        ) : null}

        {/* The scheduled day - what the plan intends */}
        {entry.scheduled ? (
          <div className="rounded-[var(--radius-card)] border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text">{entry.scheduled.label}</p>
              {entry.scheduled.dayType === 'REST' ? <Moon className="size-4 text-text-subtle" aria-hidden /> : null}
            </div>
            {entry.scheduled.muscleGroups.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.scheduled.muscleGroups.map((m) => (
                  <MuscleBadge key={m.id} name={m.name} colorHex={m.colorHex} size="sm" />
                ))}
              </div>
            ) : null}
            <p className="tnum mt-2 text-xs text-text-muted">
              {entry.scheduled.exerciseCount} exercises
              {entry.scheduled.estimatedMinutes ? ` · ~${entry.scheduled.estimatedMinutes} min` : ''}
            </p>
          </div>
        ) : !session ? (
          <p className="text-sm text-text-muted">Nothing planned for this date.</p>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!session || session.status !== 'COMPLETED' ? (
            <Button
              leftIcon={session?.status === 'IN_PROGRESS' ? <Play className="size-4" /> : <Dumbbell className="size-4" />}
              isLoading={start.isPending}
              onClick={() =>
                session?.status === 'IN_PROGRESS'
                  ? navigate(`/app/workout/${session.id}`)
                  : start.mutate({ date: entry.date, planDayId: entry.scheduled?.dayType === 'REST' ? undefined : (entry.scheduled?.planDayId ?? null) })
              }
            >
              {session?.status === 'IN_PROGRESS' ? 'Resume workout' : entry.isPast ? 'Log workout for this day' : 'Start this workout'}
            </Button>
          ) : null}
          {!isEmptyDay && !editing ? (
            <Button variant="secondary" leftIcon={<PencilLine className="size-4" />} onClick={() => setEditing(true)}>
              Change this date
            </Button>
          ) : null}
          {entry.scheduled?.dayType === 'WORKOUT' && !session ? (
            <Button
              variant="secondary"
              leftIcon={<CalendarClock className="size-4" />}
              onClick={() => setConfirmShift(true)}
            >
              Shift week forward
            </Button>
          ) : null}
        </div>

        {showMarkPanel ? (
          <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface-inset p-4">
            <p className="text-xs font-semibold tracking-wide text-text-subtle uppercase">
              Mark {formatDate(entry.date, 'd MMM')} as
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['rest', Moon, 'Rest / off day'],
                  ['swap', Repeat, 'Do a workout'],
                  // "Clear" is meaningless when nothing is on the day yet.
                  ...(entry.scheduled || entry.isOverride ? ([['clear', CircleOff, 'Clear the day']] as const) : []),
                ] as const
              ).map(([m, Icon, label]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-[var(--radius-control)] border px-2 py-3 text-xs font-medium transition-colors',
                    mode === m ? 'border-accent bg-accent-soft text-accent' : 'border-border text-text-muted hover:border-border-strong',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            {mode === 'swap' ? (
              <Select
                label="Do instead"
                value={overrideDayId ?? ''}
                onChange={(e) => setOverrideDayId(e.target.value || null)}
              >
                <option value="" disabled>Pick a workout day…</option>
                {workoutDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.positionLabel} - {d.displayLabel}
                  </option>
                ))}
              </Select>
            ) : null}

            <div>
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNote(note === r ? '' : r)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      note === r ? 'border-accent bg-accent-soft text-accent' : 'border-border text-text-subtle hover:border-border-strong hover:text-text-muted',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Input
                label="Reason (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Diwali - gym closed"
                maxLength={80}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                isLoading={setOverride.isPending}
                disabled={mode === 'swap' && !overrideDayId}
                onClick={() =>
                  setOverride.mutate(
                    mode === 'rest'
                      ? { isRest: true, note: note.trim() || null }
                      : mode === 'swap'
                        ? { planDayId: overrideDayId, note: note.trim() || null }
                        : { planDayId: null, isRest: false, note: note.trim() || null },
                  )
                }
              >
                Save
              </Button>
              {entry.isOverride ? (
                <Button
                  variant="ghost"
                  size="sm"
                  isLoading={clearOverride.isPending}
                  leftIcon={<RotateCcw className="size-3.5" />}
                  onClick={() => clearOverride.mutate()}
                >
                  Back to recurring
                </Button>
              ) : null}
              {!isEmptyDay ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              ) : null}
            </div>
            <p className="text-[11px] text-text-subtle">
              This changes {formatDate(entry.date, 'd MMM')} only - your weekly plan is untouched.
            </p>
          </div>
        ) : null}

        <ShiftForwardDialog date={entry.date} open={confirmShift} onClose={() => setConfirmShift(false)} />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* The calendar                                                         */
/* ------------------------------------------------------------------ */

export default function CalendarPage() {
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<ScheduleEntry | null>(null);
  const monthKey = format(anchor, 'yyyy-MM');

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.scheduleMonth(monthKey),
    queryFn: () => api.get<Schedule>('/schedule/month', { query: { month: monthKey } }),
    placeholderData: (previous) => previous,
  });

  const entriesByDate = useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    for (const e of data?.entries ?? []) map.set(e.date, e);
    return map;
  }, [data]);

  const cells = useMemo(() => {
    const first = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let d = first; d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(d);
    return days;
  }, [anchor]);

  const legend: Array<{ state: CellState; label: string }> = [
    { state: 'completed', label: 'Completed' },
    { state: 'partial', label: 'Partial' },
    { state: 'missed', label: 'Missed' },
    { state: 'rest', label: 'Rest' },
    { state: 'scheduled', label: 'Upcoming' },
  ];

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Your training month - completed, missed, rest and scheduled days."
        action={
          <Button variant="secondary" size="sm" onClick={() => setAnchor(new Date())} leftIcon={<CalendarDays className="size-4" />}>
            Today
          </Button>
        }
      />

      {isPending ? (
        <PageLoader label="Loading calendar" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          {/* Month nav */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">{format(anchor, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setAnchor((a) => addMonths(a, -1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setAnchor((a) => addMonths(a, 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
            <div className="grid grid-cols-7 border-b border-border">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="px-1 py-2 text-center text-[11px] font-semibold tracking-wide text-text-subtle uppercase">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day) => {
                const iso = format(day, 'yyyy-MM-dd');
                const entry = entriesByDate.get(iso);
                const state: CellState = entry?.state ?? 'empty';
                const inMonth = isSameMonth(day, anchor);
                const today = isToday(day);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!entry}
                    onClick={() => entry && setSelected(entry)}
                    aria-label={`${format(day, 'EEEE d MMMM')} - ${STATE_LABEL[state]}`}
                    className={cn(
                      'relative flex min-h-14 flex-col items-center justify-start border-r border-b border-border px-1 pt-1.5 transition-colors sm:min-h-20',
                      'last:border-r-0 disabled:cursor-default',
                      entry && 'hover:bg-surface-hover',
                      !inMonth && 'opacity-35',
                    )}
                  >
                    <span
                      className={cn(
                        'tnum flex size-6 items-center justify-center rounded-full text-xs font-medium',
                        today ? 'bg-accent text-accent-contrast' : 'text-text-muted',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {state !== 'empty' ? (
                      <span
                        title={entry?.overrideNote ?? undefined}
                        className={cn(
                          'mt-1 flex h-6 w-full items-center justify-center overflow-hidden rounded-[4px] px-0.5 text-[9px] font-semibold sm:h-7 sm:text-[10px]',
                          STATE_STYLE[state],
                        )}
                      >
                        <span className="truncate">
                          {entry?.overrideNote ?? `${entry?.isOverride ? '± ' : ''}${
                            state === 'completed' ? 'Done' : state === 'missed' ? 'Missed' : state === 'rest' ? 'Rest' : state === 'in_progress' ? 'Now' : state === 'partial' ? 'Part' : entry?.scheduled?.exerciseCount ? `${entry.scheduled.exerciseCount} ex` : '-'
                          }`}
                        </span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend - never rely on colour alone */}
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {legend.map((l) => (
              <li key={l.state} className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className={cn('size-2.5 rounded-sm', STATE_STYLE[l.state])} aria-hidden />
                {l.label}
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="text-[10px] font-semibold text-text-subtle">±</span> edited for that date
            </li>
          </ul>
        </>
      )}

      {selected ? <DaySheet entry={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
