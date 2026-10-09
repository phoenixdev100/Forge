import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Workout data changes because *this* user changed it, so aggressive
      // background refetching buys nothing and costs battery in the gym.
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.isAuthError || error.status === 404 || error.status === 403) return false;
          return error.isRetryable && failureCount < 2;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/** Central key factory - keeps invalidation honest and typo-free. */
export const qk = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  plans: ['plans'] as const,
  plan: (id: string) => ['plans', id] as const,
  activePlan: ['plans', 'active'] as const,
  templates: ['plans', 'templates'] as const,
  muscleGroups: (tree = false) => ['muscle-groups', { tree }] as const,
  equipment: ['library', 'equipment'] as const,
  categories: ['library', 'categories'] as const,
  exercises: (params: Record<string, unknown>) => ['exercises', params] as const,
  exercise: (idOrSlug: string) => ['exercises', 'detail', idOrSlug] as const,
  schedule: (from: string, to: string) => ['schedule', from, to] as const,
  scheduleMonth: (month: string) => ['schedule', 'month', month] as const,
  sessions: (params: Record<string, unknown>) => ['sessions', params] as const,
  session: (id: string) => ['sessions', id] as const,
  activeSession: ['sessions', 'active'] as const,
  progress: (params: Record<string, unknown>) => ['progress', params] as const,
  progressExercises: ['progress', 'exercises'] as const,
  exerciseProgress: (id: string) => ['progress', 'exercise', id] as const,
  records: (exerciseId?: string) => ['progress', 'records', exerciseId ?? 'all'] as const,
  goals: ['goals'] as const,
  measurements: ['measurements'] as const,
  achievements: ['achievements'] as const,
  adminExercises: (params: Record<string, unknown>) => ['admin', 'exercises', params] as const,
  adminStats: ['admin', 'stats'] as const,
};

/** Everything that a completed workout can change. */
export function invalidateWorkoutData() {
  void queryClient.invalidateQueries({ queryKey: qk.dashboard });
  void queryClient.invalidateQueries({ queryKey: ['schedule'] });
  void queryClient.invalidateQueries({ queryKey: ['sessions'] });
  void queryClient.invalidateQueries({ queryKey: ['progress'] });
}
