import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, History, Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatDuration, formatRelativeDay } from '@/lib/format';
import { formatVolume } from '@/lib/units';
import { qk } from '@/lib/queryClient';
import type { Pagination, SessionListItem, SessionStatus } from '@/lib/types';
import { useUnit } from '@/providers/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, MuscleBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';

const STATUS_TONE: Record<SessionStatus, 'success' | 'accent' | 'neutral'> = {
  COMPLETED: 'success',
  IN_PROGRESS: 'accent',
  ABANDONED: 'neutral',
};

const STATUS_LABEL: Record<SessionStatus, string> = {
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In progress',
  ABANDONED: 'Ended early',
};

export default function HistoryPage() {
  const unit = useUnit();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.sessions({ page, status }),
    queryFn: () =>
      api.get<{ sessions: SessionListItem[]; pagination: Pagination }>('/sessions', {
        query: { page, pageSize: 20, status: status || undefined },
      }),
    placeholderData: (previous) => previous,
  });

  return (
    <div>
      <PageHeader
        title="Workout history"
        description="Every session, exactly as you performed it."
        action={
          <Select
            aria-label="Filter by status"
            containerClassName="w-40"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All sessions</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="ABANDONED">Ended early</option>
          </Select>
        }
      />

      {isPending ? (
        <ul className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </ul>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.sessions.length ? (
        <EmptyState
          icon={<History className="size-5" />}
          title={status ? 'No sessions match that filter' : 'No workouts yet'}
          description={
            status
              ? 'Try a different status filter.'
              : 'Finish your first workout and it lands here - a permanent record of what you actually did.'
          }
          action={status ? undefined : <ButtonLink to="/app/today" leftIcon={<Dumbbell className="size-4" />}>Start today's workout</ButtonLink>}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {data.sessions.map((session) => (
              <li key={session.id}>
                <Link
                  to={`/app/history/${session.id}`}
                  className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-hover"
                >
                  {/* Date block */}
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-[var(--radius-control)] bg-surface-inset py-2">
                    <span className="tnum text-lg leading-none font-semibold text-text">{formatDate(session.date, 'd')}</span>
                    <span className="mt-1 text-[10px] font-medium tracking-wide text-text-subtle uppercase">
                      {formatDate(session.date, 'MMM')}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text group-hover:text-accent">{session.title}</p>
                      <Badge tone={STATUS_TONE[session.status]} size="sm">{STATUS_LABEL[session.status]}</Badge>
                      {session.prCount ? (
                        <Badge tone="accent" size="sm">
                          <Trophy className="size-3" aria-hidden /> {session.prCount} PR{session.prCount === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                      <span>{formatRelativeDay(session.date)}</span>
                      <span className="tnum">{session.exerciseCount} exercises</span>
                      <span className="tnum">{session.totalSets} sets</span>
                      {session.durationSeconds ? <span className="tnum">{formatDuration(session.durationSeconds)}</span> : null}
                      {session.totalVolumeKg ? <span className="tnum">{formatVolume(session.totalVolumeKg, unit)}</span> : null}
                    </div>
                    {session.muscleGroups.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {session.muscleGroups.slice(0, 4).map((m) => (
                          <MuscleBadge key={m.id} name={m.name} colorHex={m.colorHex} size="sm" />
                        ))}
                        {session.muscleGroups.length > 4 ? (
                          <span className="text-[11px] text-text-subtle">+{session.muscleGroups.length - 4}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <ChevronRight className="size-4 shrink-0 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-text" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>

          {data.pagination.totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-between" aria-label="History pages">
              <p className="text-sm text-text-subtle">
                Page <span className="tnum font-medium text-text">{data.pagination.page}</span> of{' '}
                <span className="tnum">{data.pagination.totalPages}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} leftIcon={<ChevronLeft className="size-4" />}>
                  Newer
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronRight className="size-4" />}
                >
                  Older
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      <div className="mt-6 text-center">
        <ButtonLink variant="ghost" size="sm" to="/app/calendar" leftIcon={<CalendarDays className="size-4" />}>
          See it on the calendar
        </ButtonLink>
      </div>
    </div>
  );
}
