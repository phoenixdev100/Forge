import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Dumbbell, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { humanizeEnum } from '@/lib/format';
import { qk } from '@/lib/queryClient';
import type { Category, Equipment, Exercise, MuscleGroup, Pagination } from '@/lib/types';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { Badge, DifficultyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { PageHeader } from '@/components/layout/AppShell';
import { CreateExerciseDialog } from './CreateExerciseDialog';

function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function ExerciseLibraryPage() {
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const query = params.get('q') ?? '';
  const muscle = params.get('muscle');
  const equipment = params.get('equipment');
  const category = params.get('category');
  const difficulty = params.get('difficulty');
  const source = params.get('source') ?? 'all';
  const sort = params.get('sort') ?? 'relevance';
  const page = Number(params.get('page') ?? '1') || 1;

  const debouncedQuery = useDebounced(query);

  const setParam = (key: string, value: string | null) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  };

  const { data: muscleData } = useQuery({
    queryKey: qk.muscleGroups(),
    queryFn: () => api.get<{ muscleGroups: MuscleGroup[] }>('/muscle-groups'),
    staleTime: 10 * 60_000,
  });
  const { data: equipmentData } = useQuery({
    queryKey: qk.equipment,
    queryFn: () => api.get<{ equipment: Equipment[] }>('/library/equipment'),
    staleTime: 10 * 60_000,
  });
  const { data: categoryData } = useQuery({
    queryKey: qk.categories,
    queryFn: () => api.get<{ categories: Category[] }>('/library/categories'),
    staleTime: 10 * 60_000,
  });

  const queryParams = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      muscle: muscle ?? undefined,
      equipment: equipment ?? undefined,
      category: category ?? undefined,
      difficulty: difficulty ?? undefined,
      source,
      sort,
      page,
      pageSize: 24,
    }),
    [debouncedQuery, muscle, equipment, category, difficulty, source, sort, page],
  );

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: qk.exercises(queryParams),
    queryFn: () => api.get<{ exercises: Exercise[]; pagination: Pagination }>('/exercises', { query: queryParams }),
    placeholderData: (previous) => previous,
  });

  const activeFilterCount = [muscle, equipment, category, difficulty].filter(Boolean).length;
  const topLevelMuscles = (muscleData?.muscleGroups ?? []).filter((g) => !g.parentId);

  return (
    <div>
      <PageHeader
        title="Exercise library"
        description={data ? `${data.pagination.total} exercises` : 'Every movement, with demonstrations and instructions.'}
        action={
          <Button variant="secondary" onClick={() => setCreateOpen(true)} leftIcon={<Plus className="size-4" />}>
            Custom exercise
          </Button>
        }
      />

      {/* Search + filter bar */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setParam('q', e.target.value || null)}
              placeholder='Search - try "bench", "curl", "squat"…'
              aria-label="Search exercises"
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-inset pr-9 pl-9 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setParam('q', null)}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-text-subtle hover:text-text"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <Button
            variant={filtersOpen || activeFilterCount ? 'secondary' : 'outline'}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            leftIcon={<SlidersHorizontal className="size-4" />}
            className="shrink-0"
          >
            Filters
            {activeFilterCount ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-contrast">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>

        {/* Muscle chips - the primary way people browse */}
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="listbox" aria-label="Muscle group">
          <button
            type="button"
            onClick={() => setParam('muscle', null)}
            className={cn(
              'h-8 shrink-0 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
              !muscle ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-muted hover:border-border-strong',
            )}
          >
            All muscles
          </button>
          {topLevelMuscles.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setParam('muscle', muscle === g.slug ? null : g.slug)}
              aria-pressed={muscle === g.slug}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
                muscle === g.slug
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-surface text-text-muted hover:border-border-strong',
              )}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Expanded filters */}
        {filtersOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="grid gap-3 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Select label="Equipment" value={equipment ?? ''} onChange={(e) => setParam('equipment', e.target.value || null)}>
              <option value="">All equipment</option>
              {(equipmentData?.equipment ?? []).map((eq) => (
                <option key={eq.id} value={eq.slug}>{eq.name} ({eq.exerciseCount})</option>
              ))}
            </Select>
            <Select label="Category" value={category ?? ''} onChange={(e) => setParam('category', e.target.value || null)}>
              <option value="">All categories</option>
              {(categoryData?.categories ?? []).map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </Select>
            <Select label="Difficulty" value={difficulty ?? ''} onChange={(e) => setParam('difficulty', e.target.value || null)}>
              <option value="">Any difficulty</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </Select>
            <Select label="Source" value={source} onChange={(e) => setParam('source', e.target.value)}>
              <option value="all">Library + mine</option>
              <option value="library">Built-in library</option>
              <option value="mine">My custom exercises</option>
            </Select>
          </motion.div>
        ) : null}
      </div>

      {/* Results grid */}
      {isPending ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Loading exercises">
          {Array.from({ length: 12 }, (_, i) => (
            <li key={i} className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.exercises.length ? (
        <EmptyState
          icon={<Dumbbell className="size-5" />}
          title={query ? `No exercises match "${query}"` : 'No exercises match these filters'}
          description="Try a shorter search or clear a filter. You can also create a custom exercise."
          action={<Button variant="secondary" onClick={() => setCreateOpen(true)} leftIcon={<Plus className="size-4" />}>Create custom exercise</Button>}
          secondaryAction={
            <Button variant="ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Clear all filters
            </Button>
          }
        />
      ) : (
        <>
          <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', isFetching && 'opacity-70 transition-opacity')}>
            {data.exercises.map((exercise, i) => (
              <motion.li
                key={exercise.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
              >
                <Link
                  to={`/app/exercises/${exercise.slug}`}
                  className="group block overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface transition-colors hover:border-border-strong"
                >
                  <div className="relative">
                    <ExerciseMedia media={exercise.media} name={exercise.name} mode="card" rounded={false} className="aspect-[4/3] w-full" />
                    {exercise.isCustom ? (
                      <span className="absolute top-2 left-2 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-semibold text-text backdrop-blur-sm">
                        Custom
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-text group-hover:text-accent">{exercise.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs text-text-subtle">{exercise.primaryMuscle.name}</span>
                      {exercise.equipment ? (
                        <span className="text-xs text-text-subtle">· {exercise.equipment.name}</span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <DifficultyBadge difficulty={exercise.difficulty} />
                      <Badge size="sm">{humanizeEnum(exercise.mechanic)}</Badge>
                    </div>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>

          {/* Pagination */}
          {data.pagination.totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-between" aria-label="Exercise pages">
              <p className="text-sm text-text-subtle">
                Page <span className="tnum font-medium text-text">{data.pagination.page}</span> of{' '}
                <span className="tnum">{data.pagination.totalPages}</span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setParam('page', String(page - 1))}
                  leftIcon={<ChevronLeft className="size-4" />}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setParam('page', String(page + 1))}
                  rightIcon={<ChevronRight className="size-4" />}
                >
                  Next
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      <CreateExerciseDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
