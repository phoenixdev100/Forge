import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, ChevronRight, Dumbbell, Flame, HeartPulse, Repeat, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { formatVolume, formatWeight } from '@/lib/units';
import { qk } from '@/lib/queryClient';
import type { ExerciseProgress, MuscleRecovery, ProgressOverview } from '@/lib/types';
import { useUnit } from '@/providers/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader, StatTile } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States';

const RANGE_OPTIONS = [
  { weeks: 8, label: '8w' },
  { weeks: 12, label: '12w' },
  { weeks: 26, label: '6m' },
  { weeks: 52, label: '1y' },
] as const;

const tooltipStyle = {
  backgroundColor: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'var(--color-text)',
  boxShadow: 'var(--shadow-raised)',
} as const;

function WeeklyVolumeChart({ data, unit }: { data: ProgressOverview['volumeTrend']; unit: ReturnType<typeof useUnit> }) {
  const points = data.map((p) => ({ ...p, display: Math.round((unit === 'LB' ? p.volumeKg * 2.20462 : p.volumeKg) * 10) / 10 }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickFormatter={(d: string) => formatDate(d, 'd MMM')}
          tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(d) => `Week of ${formatDate(String(d), 'd MMM')}`}
          formatter={(value) => [formatVolume(Number(value), unit), 'Volume']}
        />
        <Area type="monotone" dataKey="display" stroke="var(--color-accent)" strokeWidth={2} fill="url(#vol)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MuscleBalanceChart({ data }: { data: ProgressOverview['muscleGroupBalance'] }) {
  const top = data.slice(0, 7);
  const total = top.reduce((s, m) => s + m.sets, 0) || 1;
  return (
    <div className="flex items-center gap-6">
      <PieChart width={130} height={130}>
        <Pie data={top} dataKey="sets" innerRadius={40} outerRadius={60} strokeWidth={0} isAnimationActive>
          {top.map((m) => (
            <Cell key={m.id} fill={m.colorHex} />
          ))}
        </Pie>
      </PieChart>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {top.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.colorHex }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-text-muted">{m.name}</span>
            <span className="tnum shrink-0 text-text-subtle">{Math.round((m.sets / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * How recovered each muscle is - "what can I hit today?" answered at a glance.
 * Longest-rested first, so the top of the list is always the suggestion.
 */
function MuscleRecoveryCard({ muscles }: { muscles: MuscleRecovery[] }) {
  const sorted = [...muscles].sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));

  const freshness = (m: MuscleRecovery): { label: string; tone: string } => {
    if (m.daysSince == null) return { label: 'Never trained', tone: 'text-text-subtle' };
    if (m.daysSince === 0) return { label: 'Today', tone: 'text-warning' };
    if (m.daysSince === 1) return { label: 'Yesterday', tone: 'text-warning' };
    if (m.daysSince <= 3) return { label: `${m.daysSince}d ago`, tone: 'text-text-muted' };
    return { label: `${m.daysSince}d ago - fresh`, tone: 'text-success' };
  };

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((m) => {
        const f = freshness(m);
        return (
          <span
            key={m.id}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-inset px-3 py-1.5"
            title={m.setsLast7d ? `${m.setsLast7d} working sets in the last 7 days` : 'No working sets this week'}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: m.colorHex }} aria-hidden />
            <span className="text-xs font-medium text-text">{m.name}</span>
            <span className={cn('tnum text-[11px]', f.tone)}>{f.label}</span>
          </span>
        );
      })}
    </div>
  );
}

const EXERCISE_METRICS = [
  { key: 'maxWeightKg', label: 'Weight' },
  { key: 'estimatedOneRmKg', label: 'e1RM' },
  { key: 'totalReps', label: 'Reps' },
  { key: 'volumeKg', label: 'Volume' },
] as const;

function ExerciseTrendChart({ exerciseId }: { exerciseId: string }) {
  const unit = useUnit();
  const [metric, setMetric] = useState<(typeof EXERCISE_METRICS)[number]['key']>('maxWeightKg');
  const { data: progress } = useQuery({
    queryKey: qk.exerciseProgress(exerciseId),
    queryFn: () => api.get<ExerciseProgress>(`/progress/exercises/${exerciseId}`),
  });
  const isWeightMetric = metric === 'maxWeightKg' || metric === 'estimatedOneRmKg' || metric === 'volumeKg';
  const points = (progress?.points ?? []).map((p) => ({
    ...p,
    display: isWeightMetric ? Math.round((unit === 'LB' ? p[metric] * 2.20462 : p[metric]) * 100) / 100 : p[metric],
  }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-text">{progress?.exercise.name}</p>
        <div className="flex rounded-[var(--radius-control)] bg-surface-inset p-0.5">
          {EXERCISE_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={cn(
                'h-7 rounded-[6px] px-2.5 text-xs font-medium transition-colors',
                metric === m.key ? 'bg-surface text-text shadow-sm' : 'text-text-subtle hover:text-text',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="ex" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d, 'd MMM')} tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(d) => formatDate(String(d), 'd MMM yyyy')}
            formatter={(value) => [isWeightMetric ? formatWeight(Number(value), unit) : value, EXERCISE_METRICS.find((m) => m.key === metric)?.label]}
          />
          <Area type="monotone" dataKey="display" stroke="var(--color-accent)" strokeWidth={2} fill="url(#ex)" />
        </AreaChart>
      </ResponsiveContainer>
      {progress ? (
        <p className="mt-2 text-xs text-text-subtle">
          {progress.totals.sessions} sessions · {progress.totals.sets} sets · best {formatWeight(progress.totals.maxWeightKg, unit)}
        </p>
      ) : null}
    </div>
  );
}

export default function ProgressPage() {
  const unit = useUnit();
  const [weeks, setWeeks] = useState(12);
  const [exerciseId, setExerciseId] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.progress({ weeks }),
    queryFn: () => api.get<ProgressOverview>('/progress', { query: { weeks } }),
  });

  const { data: trained } = useQuery({
    queryKey: qk.progressExercises,
    queryFn: () => api.get<{ exercises: Array<{ id: string; slug: string; name: string; sessions: number }> }>('/progress/exercises'),
  });

  const { data: recovery } = useQuery({
    queryKey: qk.recovery,
    queryFn: () => api.get<{ muscles: MuscleRecovery[] }>('/progress/recovery'),
  });

  const trainedList = trained?.exercises ?? [];
  const selectedExercise = exerciseId ?? trainedList[0]?.id ?? null;

  if (isPending) return <PageLoader label="Loading your progress" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { totals, streak, volumeTrend, muscleGroupBalance } = data;

  return (
    <div>
      <PageHeader
        title="Progress"
        description={totals.totalWorkouts ? 'Am I getting stronger? Here is the answer.' : undefined}
        action={
          <div className="flex rounded-[var(--radius-control)] bg-surface-inset p-0.5" role="tablist" aria-label="Time range">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.weeks}
                type="button"
                role="tab"
                aria-selected={weeks === r.weeks}
                onClick={() => setWeeks(r.weeks)}
                className={cn(
                  'tnum h-7 rounded-[6px] px-2.5 text-xs font-medium transition-colors',
                  weeks === r.weeks ? 'bg-surface text-text shadow-sm' : 'text-text-subtle hover:text-text',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {!totals.totalWorkouts ? (
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="No data to chart yet"
          description="Charts build themselves from your workouts - finish a session and this page lights up."
          action={
            <Link to="/app/today" className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-accent px-4 text-sm font-semibold text-accent-contrast hover:bg-accent-hover">
              Start a workout
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Workouts" value={totals.totalWorkouts} sub={`${totals.thisWeek.workouts} this week`} icon={<Dumbbell className="size-4" />} />
            <StatTile label="Sets" value={totals.totalSets} icon={<Repeat className="size-4" />} />
            <StatTile label="Volume" value={formatVolume(totals.totalVolumeKg, unit)} icon={<TrendingUp className="size-4" />} />
            <StatTile label="Streak" value={`${streak.current}d`} sub={`best ${streak.longest}d`} icon={<Flame className="size-4" />} tone="accent" />
          </div>

          {recovery?.muscles.length ? (
            <Card>
              <CardHeader
                title="Muscle recovery"
                description="Longest-rested first - the top of the list is what to train next"
                icon={<HeartPulse className="size-4" />}
              />
              <CardBody className="pt-4">
                <MuscleRecoveryCard muscles={recovery.muscles} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Weekly volume" description="Total weight moved per week" icon={<TrendingUp className="size-4" />} />
            <CardBody className="pt-4">
              <WeeklyVolumeChart data={volumeTrend} unit={unit} />
            </CardBody>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Muscle balance" description="Share of completed sets, this period" />
              <CardBody className="pt-4">
                {muscleGroupBalance.length ? (
                  <MuscleBalanceChart data={muscleGroupBalance} />
                ) : (
                  <p className="py-8 text-center text-sm text-text-muted">Log a few workouts to see your training balance.</p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Exercise progress"
                icon={<TrendingUp className="size-4" />}
                action={
                  trainedList.length ? (
                    <Select
                      value={selectedExercise ?? ''}
                      onChange={(e) => setExerciseId(e.target.value)}
                      aria-label="Pick an exercise"
                      containerClassName="w-44"
                      className="h-8 px-2 text-xs"
                    >
                      {trainedList.map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </Select>
                  ) : undefined
                }
              />
              <CardBody className="pt-4">
                {selectedExercise ? (
                  <ExerciseTrendChart exerciseId={selectedExercise} />
                ) : (
                  <p className="py-8 text-center text-sm text-text-muted">Train an exercise to see its trend here.</p>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Per-exercise index */}
          {trainedList.length ? (
            <Card>
              <CardHeader title="Every exercise" description="Tap one to open its full progress page" icon={<Dumbbell className="size-4" />} />
              <ul className="divide-y divide-border">
                {trainedList.slice(0, 12).map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/app/progress/${e.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-hover"
                    >
                      <span className="truncate text-sm font-medium text-text">{e.name}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-text-subtle">
                        <span className="tnum">{e.sessions} sessions</span>
                        <ChevronRight className="size-3.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
