import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { dayKey, formatDate, isLiftRecord, PR_TYPE_LABELS } from '@/lib/format';
import { formatWeight } from '@/lib/units';
import { qk } from '@/lib/queryClient';
import type { PersonalRecord } from '@/lib/types';
import { useUnit } from '@/providers/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States';

export default function RecordsPage() {
  const unit = useUnit();
  const [exerciseId, setExerciseId] = useState('');

  const { data: trained } = useQuery({
    queryKey: qk.progressExercises,
    queryFn: () => api.get<{ exercises: Array<{ id: string; name: string }> }>('/progress/exercises'),
  });

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.records(exerciseId || undefined),
    queryFn: () =>
      api.get<{ history: PersonalRecord[] }>('/progress/records', {
        query: { exerciseId: exerciseId || undefined },
      }),
  });

  const formatValue = (r: PersonalRecord) =>
    r.type === 'MAX_REPS'
      ? `${r.value} reps`
      : r.type === 'BEST_TIME'
        ? `${r.value}s`
        : r.type === 'BEST_DISTANCE'
          ? `${r.value}m`
          : formatWeight(r.value, unit);

  /** The set that earned it: "at 60 kg" under a reps record, "× 8" under a weight record. */
  const recordContext = (r: PersonalRecord) =>
    r.type === 'MAX_WEIGHT' && r.reps != null
      ? `× ${r.reps} reps`
      : r.type === 'MAX_REPS' && r.weightKg != null
        ? `at ${formatWeight(r.weightKg, unit)}`
        : null;

  const list = (data?.history ?? []).filter(isLiftRecord);

  // History arrives newest-first: group it into date sections, then one card
  // per exercise holding every record it earned that day.
  const byDate = new Map<string, Map<string, PersonalRecord[]>>();
  for (const r of list) {
    const day = dayKey(r.achievedAt);
    let exercises = byDate.get(day);
    if (!exercises) byDate.set(day, (exercises = new Map()));
    const existing = exercises.get(r.exercise.id);
    if (existing) existing.push(r);
    else exercises.set(r.exercise.id, [r]);
  }
  const typeOrder = ['MAX_WEIGHT', 'MAX_REPS', 'BEST_TIME', 'BEST_DISTANCE'];
  for (const exercises of byDate.values()) {
    for (const records of exercises.values()) {
      records.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
    }
  }

  const formatPrev = (r: PersonalRecord) =>
    r.previousValue == null
      ? null
      : r.type === 'MAX_REPS'
        ? `${r.previousValue} reps`
        : r.type === 'BEST_TIME'
          ? `${r.previousValue}s`
          : r.type === 'BEST_DISTANCE'
            ? `${r.previousValue}m`
            : formatWeight(r.previousValue, unit);

  return (
    <div>
      <PageHeader
        title="Personal records"
        description="Every time you beat yourself, it lands here automatically."
        action={
          trained?.exercises?.length ? (
            <Select
              aria-label="Filter by exercise"
              containerClassName="w-48"
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
            >
              <option value="">All exercises</option>
              {trained.exercises.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          ) : undefined
        }
      />

      {isPending ? (
        <PageLoader label="Loading records" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !list.length ? (
        <EmptyState
          icon={<Trophy className="size-5" />}
          title="No personal records yet"
          description="Records appear the moment you complete a workout that beats a previous best - heaviest weight, most reps, best volume, estimated 1RM."
          action={
            <Link to="/app/today" className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-accent px-4 text-sm font-semibold text-accent-contrast hover:bg-accent-hover">
              Start a workout
            </Link>
          }
        />
      ) : (
        <div className="space-y-7">
          {[...byDate.entries()].map(([date, exercises]) => (
            <section key={date}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="shrink-0 text-xs font-semibold tracking-wider text-text-subtle uppercase">
                  {formatDate(date, 'EEEE, d MMMM yyyy')}
                </h2>
                <div className="h-px flex-1 bg-border" aria-hidden />
              </div>
              <ul className="space-y-2">
                {[...exercises.entries()].map(([exerciseId, records]) => {
                  const exercise = records[0]!.exercise;
                  const sessionId = records.find((r) => r.sessionId)?.sessionId;
                  return (
                    <li key={exerciseId} className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <Link to={`/app/progress/${exerciseId}`} className="truncate text-sm font-semibold text-text hover:text-accent">
                          {exercise.name}
                        </Link>
                        {sessionId ? (
                          <Link to={`/app/history/${sessionId}`} className="shrink-0 text-xs font-medium text-accent hover:underline">
                            workout
                          </Link>
                        ) : null}
                      </div>
                      <ul className="mt-2.5 space-y-1.5">
                        {records.map((r) => {
                          const prev = formatPrev(r);
                          const context = recordContext(r);
                          return (
                            <li key={r.id} className="flex items-baseline justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-sm text-text-muted">
                                <Trophy className="size-3.5 shrink-0 text-accent" aria-hidden />
                                {PR_TYPE_LABELS[r.type]}
                              </span>
                              <span className="tnum shrink-0 text-right text-sm font-semibold text-text">
                                {formatValue(r)}
                                <span className="ml-1.5 text-xs font-normal text-text-subtle">
                                  {context}
                                  {context && prev ? ' · ' : ''}
                                  {prev ? `was ${prev}` : ''}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
