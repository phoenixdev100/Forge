import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Dumbbell, Repeat, TrendingUp, Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, isLiftRecord, PR_TYPE_LABELS } from '@/lib/format';
import { formatVolume, formatWeight } from '@/lib/units';
import { qk } from '@/lib/queryClient';
import type { ExerciseProgress, PersonalRecord } from '@/lib/types';
import { useUnit } from '@/providers/AuthProvider';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { MuscleBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, StatTile } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States';

const METRICS = [
  { key: 'maxWeightKg', label: 'Max weight' },
  { key: 'estimatedOneRmKg', label: 'Est. 1RM' },
  { key: 'maxReps', label: 'Max reps' },
  { key: 'volumeKg', label: 'Volume' },
] as const;

const tooltipStyle = {
  backgroundColor: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'var(--color-text)',
  boxShadow: 'var(--shadow-raised)',
} as const;

export default function ExerciseProgressPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const unit = useUnit();
  const [metric, setMetric] = useState<(typeof METRICS)[number]['key']>('maxWeightKg');

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.exerciseProgress(exerciseId!),
    queryFn: () => api.get<ExerciseProgress>(`/progress/exercises/${exerciseId}`),
    enabled: Boolean(exerciseId),
  });

  const { data: records } = useQuery({
    queryKey: qk.records(exerciseId!),
    queryFn: () => api.get<{ history: PersonalRecord[] }>('/progress/records', { query: { exerciseId } }),
    enabled: Boolean(exerciseId),
  });

  if (isPending) return <PageLoader label="Loading exercise progress" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { exercise, points, totals } = data;
  const isWeightMetric = metric !== 'maxReps';
  const chartPoints = points.map((p) => ({
    ...p,
    display: isWeightMetric ? Math.round((unit === 'LB' ? p[metric] * 2.20462 : p[metric]) * 100) / 100 : p[metric],
  }));

  // Trajectory: first → last session on the chosen metric.
  const delta =
    chartPoints.length >= 2 ? chartPoints[chartPoints.length - 1]!.display - chartPoints[0]!.display : null;

  return (
    <div>
      <Link to="/app/progress" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Progress
      </Link>

      <div className="mb-6 flex items-start gap-4">
        <ExerciseMedia
          media={{
            type: 'IMAGE',
            posterUrl: exercise.thumbnailUrl,
            loopUrl: null,
            frames: [],
            isVideo: false,
            canAnimate: false,
            hasMedia: Boolean(exercise.thumbnailUrl),
          }}
          name={exercise.name}
          mode="thumb"
          className="size-16 shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">{exercise.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <MuscleBadge name={exercise.primaryMuscle.name} colorHex={exercise.primaryMuscle.colorHex} size="sm" />
            <Link to={`/app/exercises/${exercise.slug}`} className="text-xs font-medium text-accent hover:underline">
              Exercise page →
            </Link>
          </div>
        </div>
      </div>

      {!points.length ? (
        <EmptyState
          icon={<TrendingUp className="size-5" />}
          title="No sessions on this exercise yet"
          description="Perform it once and its trend line starts here."
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Best weight" value={formatWeight(totals.maxWeightKg, unit)} icon={<Trophy className="size-4" />} />
            <StatTile label="Best reps" value={totals.maxReps || '-'} icon={<Repeat className="size-4" />} />
            <StatTile label="Best e1RM" value={formatWeight(totals.maxOneRmKg, unit)} icon={<TrendingUp className="size-4" />} />
            <StatTile label="Total volume" value={formatVolume(totals.volumeKg, unit)} icon={<Dumbbell className="size-4" />} />
          </div>

          <Card className="mb-5">
            <CardHeader
              title="Over time"
              description={
                delta != null
                  ? `${delta >= 0 ? '+' : ''}${delta.toFixed(isWeightMetric ? 1 : 0)} ${isWeightMetric ? (unit === 'LB' ? 'lb' : 'kg') : 'reps'} since ${formatDate(points[0]!.date, 'd MMM')}`
                  : undefined
              }
              icon={<TrendingUp className="size-4" />}
              action={
                <div className="flex rounded-[var(--radius-control)] bg-surface-inset p-0.5">
                  {METRICS.map((m) => (
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
              }
            />
            <CardBody className="pt-4">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartPoints} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                  <defs>
                    <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
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
                    formatter={(v) => [isWeightMetric ? formatWeight(Number(v), unit) : v, METRICS.find((m) => m.key === metric)?.label]}
                  />
                  <Area type="monotone" dataKey="display" stroke="var(--color-accent)" strokeWidth={2} fill="url(#p)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Session-by-session table */}
          <Card className="mb-5">
            <CardHeader title="Sessions" description="Best set per session" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold tracking-wide text-text-subtle uppercase">
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Sets</th>
                    <th className="px-4 py-2.5 text-right">Best</th>
                    <th className="px-4 py-2.5 text-right">Volume</th>
                    <th className="px-5 py-2.5 text-right">e1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().map((p) => (
                    <tr key={p.sessionId} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-5 py-2.5">
                        <Link to={`/app/history/${p.sessionId}`} className="font-medium text-text hover:text-accent">
                          {formatDate(p.date, 'd MMM yyyy')}
                        </Link>
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-text-muted">{p.sets}</td>
                      <td className="tnum px-4 py-2.5 text-right font-medium text-text">
                        {formatWeight(p.maxWeightKg, unit)}{p.maxReps ? ` × ${p.maxReps}` : ''}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-text-muted">{formatWeight(p.volumeKg, unit)}</td>
                      <td className="tnum px-5 py-2.5 text-right text-text-muted">{formatWeight(p.estimatedOneRmKg, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {records?.history.filter(isLiftRecord).length ? (
            <Card>
              <CardHeader title="Records" icon={<Trophy className="size-4" />} />
              <CardBody className="pt-4">
                <ul className="space-y-2">
                  {records.history.filter(isLiftRecord).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-surface-inset px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-text">{PR_TYPE_LABELS[r.type]}</p>
                        <p className="text-xs text-text-subtle">
                          {formatDate(r.achievedAt, 'd MMM yyyy')}
                          {r.type === 'MAX_WEIGHT' && r.reps != null
                            ? ` · × ${r.reps} reps`
                            : r.type === 'MAX_REPS' && r.weightKg != null
                              ? ` · at ${formatWeight(r.weightKg, unit)}`
                              : ''}
                        </p>
                      </div>
                      <span className="tnum text-sm font-semibold text-text">
                        {r.type === 'MAX_REPS' ? `${r.value} reps` : r.type === 'BEST_TIME' ? `${r.value}s` : r.type === 'BEST_DISTANCE' ? `${r.value}m` : formatWeight(r.value, unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
