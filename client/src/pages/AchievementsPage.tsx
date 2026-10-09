import { useQuery } from '@tanstack/react-query';
import { Compass, Dumbbell, Flag, Flame, Layers, Lock, Medal, TrendingUp, Trophy, Weight } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, humanizeEnum } from '@/lib/format';
import { qk } from '@/lib/queryClient';
import type { Achievement } from '@/lib/types';
import { PageHeader } from '@/components/layout/AppShell';
import { ProgressBar } from '@/components/ui/Progress';
import { ErrorState, PageLoader } from '@/components/ui/States';

const ICONS: Record<string, typeof Flag> = {
  flag: Flag,
  dumbbell: Dumbbell,
  trophy: Trophy,
  flame: Flame,
  'trending-up': TrendingUp,
  layers: Layers,
  weight: Weight,
  compass: Compass,
  medal: Medal,
};

export default function AchievementsPage() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.achievements,
    queryFn: () => api.get<{ achievements: Achievement[]; unlockedCount: number }>('/achievements'),
  });

  if (isPending) return <PageLoader label="Loading achievements" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const categories = ['MILESTONE', 'CONSISTENCY', 'STRENGTH', 'VOLUME', 'EXPLORATION'] as const;

  return (
    <div>
      <PageHeader
        title="Achievements"
        description={`${data.unlockedCount} of ${data.achievements.length} earned. Quiet milestones, no points economy.`}
      />

      <div className="space-y-8">
        {categories.map((category) => {
          const items = data.achievements.filter((a) => a.category === category);
          if (!items.length) return null;
          return (
            <section key={category}>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-subtle uppercase">{humanizeEnum(category)}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => {
                  const Icon = (a.iconKey && ICONS[a.iconKey]) || Medal;
                  const unlocked = Boolean(a.unlockedAt);
                  return (
                    <li
                      key={a.id}
                      className={cn(
                        'rounded-[var(--radius-card)] border p-4 transition-colors',
                        unlocked ? 'border-accent/40 bg-surface' : 'border-border bg-surface',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-full',
                            unlocked ? 'bg-accent-soft text-accent' : 'bg-surface-inset text-text-subtle',
                          )}
                        >
                          {unlocked ? <Icon className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-semibold', unlocked ? 'text-text' : 'text-text-muted')}>{a.name}</p>
                          <p className="mt-0.5 text-xs text-text-subtle">{a.description}</p>
                          {unlocked ? (
                            <p className="mt-1.5 text-[11px] font-medium text-accent">
                              Earned {formatDate(a.unlockedAt!, 'd MMM yyyy')}
                            </p>
                          ) : (
                            <div className="mt-2.5">
                              <ProgressBar value={a.progress} max={a.threshold} size="sm" />
                              <p className="tnum mt-1 text-[11px] text-text-subtle">
                                {a.progress} / {a.threshold}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
