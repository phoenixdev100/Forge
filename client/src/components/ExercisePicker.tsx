import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Plus, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { qk } from '@/lib/queryClient';
import type { Exercise, MuscleGroup, Pagination } from '@/lib/types';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { DifficultyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/States';
import { EmptyState } from '@/components/ui/States';

type Mode = { mode: 'single'; onPick: (exercise: Exercise) => void } | { mode: 'multi'; onAdd: (exercises: Exercise[]) => void };

type Props = Mode & {
  open: boolean;
  onClose: () => void;
  /** Pre-select a muscle group, e.g. when adding inside a labelled section. */
  initialMuscleSlug?: string;
  title?: string;
  /** Exercises already in the target - shown as "added" and not re-pickable. */
  excludeIds?: string[];
};

function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * The library picker: the same searchable, filterable exercise browser used
 * wherever the app asks "which exercise?" - plan building, mid-workout adds,
 * and exercise-detail "add to plan".
 */
export function ExercisePicker({ open, onClose, initialMuscleSlug, title = 'Add exercises', ...modeProps }: Props) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(initialMuscleSlug ?? null);
  const [selected, setSelected] = useState<Map<string, Exercise>>(new Map());
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounced(query);

  // Reset picker state each time it opens, so a stale search never hides results.
  useEffect(() => {
    if (open) {
      setQuery('');
      setMuscle(initialMuscleSlug ?? null);
      setSelected(new Map());
      setPage(1);
      // Focus after the sheet animation, not before - mobile keyboards otherwise
      // fight the slide-up transition.
      const timer = window.setTimeout(() => searchRef.current?.focus(), 350);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, initialMuscleSlug]);

  useEffect(() => setPage(1), [debouncedQuery, muscle]);

  const { data: muscleData } = useQuery({
    queryKey: qk.muscleGroups(),
    queryFn: () => api.get<{ muscleGroups: MuscleGroup[] }>('/muscle-groups'),
    staleTime: 10 * 60_000,
  });

  const params = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      muscle: muscle ?? undefined,
      page,
      pageSize: 24,
    }),
    [debouncedQuery, muscle, page],
  );

  const { data, isPending, isFetching } = useQuery({
    queryKey: qk.exercises(params),
    queryFn: () => api.get<{ exercises: Exercise[]; pagination: Pagination }>('/exercises', { query: params }),
    enabled: open,
    placeholderData: (previous) => previous,
  });

  const exclude = useMemo(() => new Set(modeProps.excludeIds ?? []), [modeProps.excludeIds]);
  const exercises = data?.exercises ?? [];
  const pagination = data?.pagination;

  const toggle = (exercise: Exercise) => {
    if (modeProps.mode === 'single') {
      modeProps.onPick(exercise);
      onClose();
      return;
    }
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(exercise.id)) next.delete(exercise.id);
      else next.set(exercise.id, exercise);
      return next;
    });
  };

  const commit = () => {
    if (modeProps.mode === 'multi') {
      modeProps.onAdd([...selected.values()]);
      setSelected(new Map());
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} variant="sheet" size="lg"
      footer={
        modeProps.mode === 'multi' ? (
          <>
            <span className="mr-auto text-sm text-text-muted">
              {selected.size ? `${selected.size} selected` : 'Tap exercises to select them'}
            </span>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={commit} disabled={!selected.size} leftIcon={<Plus className="size-4" />}>
              Add {selected.size ? `(${selected.size})` : ''}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "bench", "curl", "squat"…'
            aria-label="Search exercises"
            className="h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface-inset pr-9 pl-9 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-text-subtle hover:text-text"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {/* Muscle filter chips - horizontally scrollable, one thumb swipe */}
        <div className="scrollbar-none -mx-5 flex gap-1.5 overflow-x-auto px-5" role="listbox" aria-label="Filter by muscle group">
          <FilterChip active={!muscle} onClick={() => setMuscle(null)}>All</FilterChip>
          {(muscleData?.muscleGroups ?? [])
            .filter((g) => !g.parentId)
            .map((g) => (
              <FilterChip key={g.id} active={muscle === g.slug} onClick={() => setMuscle(muscle === g.slug ? null : g.slug)}>
                {g.name}
              </FilterChip>
            ))}
        </div>

        {/* Results */}
        <ul className="space-y-1.5" aria-busy={isFetching}>
          {isPending ? (
            Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border p-2.5">
                <Skeleton className="size-14 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))
          ) : exercises.length ? (
            exercises.map((exercise) => {
              const already = exclude.has(exercise.id);
              const isSelected = selected.has(exercise.id);
              return (
                <li key={exercise.id}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => toggle(exercise)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[var(--radius-control)] border p-2.5 text-left transition-colors',
                      isSelected
                        ? 'border-accent bg-accent-soft'
                        : 'border-border bg-surface hover:border-border-strong',
                      already && 'opacity-50',
                    )}
                  >
                    <ExerciseMedia media={exercise.media} name={exercise.name} mode="thumb" className="size-14 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{exercise.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-subtle">
                        <span>{exercise.primaryMuscle.name}</span>
                        {exercise.equipment ? <span aria-hidden>·</span> : null}
                        {exercise.equipment ? <span>{exercise.equipment.name}</span> : null}
                        <DifficultyBadge difficulty={exercise.difficulty} />
                        {exercise.isCustom ? <span className="rounded-full bg-info-soft px-1.5 py-0.5 text-[10px] font-medium text-info">Custom</span> : null}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full border',
                        already
                          ? 'border-transparent bg-surface-inset text-text-subtle'
                          : isSelected
                            ? 'border-accent bg-accent text-accent-contrast'
                            : 'border-border-strong text-text-subtle',
                      )}
                      aria-hidden
                    >
                      {already ? <Check className="size-3.5" /> : isSelected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                    </span>
                  </button>
                </li>
              );
            })
          ) : (
            <EmptyState
              icon={<Search className="size-5" />}
              title={`No exercises match ${query ? `"${query}"` : 'these filters'}`}
              description="Try a shorter search - or create a custom exercise from the library page."
              className="py-10"
            />
          )}
        </ul>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between pt-1 text-sm">
            <span className="text-text-subtle tnum">
              {pagination.total} exercise{pagination.total === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'h-8 shrink-0 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-muted hover:border-border-strong',
      )}
    >
      {children}
    </button>
  );
}
