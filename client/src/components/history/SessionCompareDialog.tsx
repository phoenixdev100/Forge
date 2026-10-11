import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { formatWeight, fromKg, trimNumber, type Unit } from '@/lib/units';
import { tracksReps, tracksWeight } from '@/lib/tracking';
import type { Pagination, SessionExercise, SessionListItem, WorkoutSession } from '@/lib/types';
import { useUnit } from '@/providers/AuthProvider';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/States';

type ExerciseRow = {
  name: string;
  a: SessionExercise | null;
  b: SessionExercise | null;
};

/** The single "how heavy" number for a row - best completed working set. */
function topSet(e: SessionExercise) {
  const done = e.sets.filter((s) => s.isCompleted && s.setType !== 'WARMUP');
  if (!done.length) return null;
  if (tracksWeight(e.trackingType)) {
    return done.reduce((best, s) =>
      (s.estimatedOneRmKg ?? 0) > (best.estimatedOneRmKg ?? 0) ? s : best,
    );
  }
  return done.reduce((best, s) => ((s.reps ?? 0) > (best.reps ?? 0) ? s : best));
}

function topSetLabel(e: SessionExercise, unit: Unit): string {
  const s = topSet(e);
  if (!s) return '-';
  const w = tracksWeight(e.trackingType) && s.weightKg != null ? `${trimNumber(fromKg(s.weightKg, unit), 1)}` : null;
  const r = tracksReps(e.trackingType) && s.reps != null ? `×${s.reps}` : null;
  const t = s.timeSeconds != null ? `${s.timeSeconds}s` : null;
  const d = s.distanceM != null ? `${trimNumber(s.distanceM, 0)}m` : null;
  return [w, r, t, d].filter(Boolean).join(' ') || '-';
}

function DeltaChip({ a, b, unit }: { a: number; b: number; unit: Unit }) {
  const diff = a - b;
  if (Math.abs(diff) < 0.01) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-text-subtle">
        <Minus className="size-3" aria-hidden /> same
      </span>
    );
  }
  const up = diff > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn('tnum inline-flex items-center gap-1 text-xs font-medium', up ? 'text-success' : 'text-danger')}>
      <Icon className="size-3" aria-hidden />
      {formatWeight(Math.abs(diff), unit)}
    </span>
  );
}

/**
 * "Am I doing better than last time?" - this session lined up against any
 * other finished workout, exercise by exercise.
 */
export function SessionCompareDialog({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: () => void;
  session: WorkoutSession;
}) {
  const unit = useUnit();
  const [otherId, setOtherId] = useState<string | null>(null);

  const { data: list } = useQuery({
    queryKey: ['sessions', { status: 'COMPLETED', pageSize: 50, for: 'compare' }],
    queryFn: () =>
      api.get<{ sessions: SessionListItem[]; pagination: Pagination }>('/sessions', {
        query: { status: 'COMPLETED', pageSize: 50 },
      }),
    enabled: open,
  });

  const candidates = useMemo(
    () => (list?.sessions ?? []).filter((s) => s.id !== session.id),
    [list, session.id],
  );

  // The fairest default is the most recent session training the same muscles;
  // the list rows don't carry planDayId, so muscle overlap is the honest proxy.
  const defaultPick = useMemo(() => {
    if (!candidates.length) return null;
    const myMuscles = new Set(session.muscleGroups.map((m) => m.id));
    const overlapping = candidates.find((c) => c.muscleGroups.some((m) => myMuscles.has(m.id)));
    return (overlapping ?? candidates[0]).id;
  }, [candidates, session]);

  const picked = otherId ?? defaultPick;

  const { data: otherData } = useQuery({
    queryKey: ['sessions', picked ?? 'none', 'compare-detail'],
    queryFn: () => api.get<{ session: WorkoutSession }>(`/sessions/${picked}`),
    enabled: open && picked != null,
  });

  useEffect(() => {
    if (!open) setOtherId(null);
  }, [open]);

  const other = otherData?.session ?? null;

  const rows = useMemo<ExerciseRow[]>(() => {
    if (!other) return [];
    const otherByExercise = new Map(other.exercises.map((e) => [e.exercise.id, e]));
    const matched = new Set<string>();
    const out: ExerciseRow[] = session.exercises.map((e) => {
      const b = otherByExercise.get(e.exercise.id) ?? null;
      if (b) matched.add(e.exercise.id);
      return { name: e.nameSnapshot, a: e, b };
    });
    for (const e of other.exercises) {
      if (!matched.has(e.exercise.id) && !session.exercises.some((mine) => mine.exercise.id === e.exercise.id)) {
        out.push({ name: e.nameSnapshot, a: null, b: e });
      }
    }
    return out;
  }, [session, other]);

  const volumeDelta = (session.totalVolumeKg ?? 0) - (other?.totalVolumeKg ?? 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Compare workouts"
      description="This session lined up against another - exercise by exercise."
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-[var(--radius-control)] border border-accent/40 bg-accent-soft/40 px-3 py-2">
            <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">This workout</p>
            <p className="mt-0.5 truncate text-sm font-medium text-text">{session.title}</p>
            <p className="text-xs text-text-muted">{formatDate(session.date, 'd MMM yyyy')}</p>
          </div>
          <div className="rounded-[var(--radius-control)] border border-border bg-surface-inset px-3 py-2">
            <p className="text-[11px] font-semibold tracking-wide text-text-subtle uppercase">Compare to</p>
            <Select
              value={picked ?? ''}
              onChange={(e) => setOtherId(e.target.value)}
              aria-label="Pick a workout to compare"
              className="mt-0.5 h-8 border-0 bg-transparent px-0 text-sm shadow-none"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {formatDate(c.date, 'd MMM')}
                </option>
              ))}
              {!candidates.length ? <option value="">No other finished workouts</option> : null}
            </Select>
          </div>
        </div>

        {picked == null ? (
          <p className="py-6 text-center text-sm text-text-muted">
            Finish another workout first - then this view shows exactly what changed.
          </p>
        ) : !other ? (
          <PageLoader label="Loading the other workout" />
        ) : (
          <>
            {/* Headline totals */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ['Volume', formatWeight(session.totalVolumeKg, unit), formatWeight(other.totalVolumeKg, unit)],
                  ['Sets', String(session.summary.completedSetCount), String(other.summary.completedSetCount)],
                  ['Exercises', String(session.summary.completedExerciseCount), String(other.summary.completedExerciseCount)],
                ] as const
              ).map(([label, a, b]) => (
                <div key={label} className="rounded-[var(--radius-control)] bg-surface-inset px-2 py-2">
                  <p className="text-[11px] tracking-wide text-text-subtle uppercase">{label}</p>
                  <p className="tnum mt-0.5 text-sm font-semibold text-text">{a}</p>
                  <p className="tnum text-xs text-text-subtle">vs {b}</p>
                </div>
              ))}
            </div>
            <p className={cn('tnum text-center text-sm font-medium', volumeDelta > 0 ? 'text-success' : volumeDelta < 0 ? 'text-danger' : 'text-text-subtle')}>
              {volumeDelta > 0 ? '+' : volumeDelta < 0 ? '-' : ''}
              {formatWeight(Math.abs(volumeDelta), unit)} volume {volumeDelta > 0 ? 'up' : volumeDelta < 0 ? 'down' : 'level'}
            </p>

            {/* Exercise-by-exercise */}
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-inset text-left text-[11px] font-semibold tracking-wide text-text-subtle uppercase">
                    <th className="px-3 py-2">Exercise</th>
                    <th className="px-3 py-2 text-right">Top set</th>
                    <th className="hidden px-3 py-2 text-right sm:table-cell">Their top</th>
                    <th className="px-3 py-2 text-right">Volume Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name} className="border-b border-border last:border-0">
                      <td className="max-w-0 truncate px-3 py-2 font-medium text-text">{row.name}</td>
                      <td className="tnum px-3 py-2 text-right text-text">
                        {row.a ? topSetLabel(row.a, unit) : <span className="text-text-subtle">not done</span>}
                      </td>
                      <td className="tnum hidden px-3 py-2 text-right text-text-muted sm:table-cell">
                        {row.b ? topSetLabel(row.b, unit) : <span className="text-text-subtle">not done</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.a && row.b ? (
                          <DeltaChip a={row.a.progress.volumeKg} b={row.b.progress.volumeKg} unit={unit} />
                        ) : (
                          <span className="text-xs text-text-subtle">only one side</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
