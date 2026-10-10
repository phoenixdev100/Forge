import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/States';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import OnboardingPage from '@/pages/OnboardingPage';
import { useAuth } from '@/providers/AuthProvider';

// App pages are code-split so the landing page stays light.
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TodayPage = lazy(() => import('@/pages/TodayPage'));
const PlansPage = lazy(() => import('@/pages/plans/PlansPage'));
const PlanBuilderPage = lazy(() => import('@/pages/plans/PlanBuilderPage'));
const ExerciseLibraryPage = lazy(() => import('@/pages/exercises/ExerciseLibraryPage'));
const ExerciseDetailPage = lazy(() => import('@/pages/exercises/ExerciseDetailPage'));
const WorkoutPage = lazy(() => import('@/pages/workout/WorkoutPage'));
const WorkoutSummaryPage = lazy(() => import('@/pages/workout/WorkoutSummaryPage'));
const HistoryPage = lazy(() => import('@/pages/history/HistoryPage'));
const SessionDetailPage = lazy(() => import('@/pages/history/SessionDetailPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const ProgressPage = lazy(() => import('@/pages/progress/ProgressPage'));
const ExerciseProgressPage = lazy(() => import('@/pages/progress/ExerciseProgressPage'));
const RecordsPage = lazy(() => import('@/pages/RecordsPage'));
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage'));
const AchievementsPage = lazy(() => import('@/pages/AchievementsPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** Public routes bounce signed-in users into the app. */
function PublicOnly() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader fullScreen />;
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return <Outlet />;
}

/** Everything under /app needs a session; new users pass through onboarding once. */
function RequireAuth() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <PageLoader fullScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !user.onboardedAt) return <Navigate to="/onboarding" replace />;
  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

/** Onboarding needs a session but must not bounce users through it twice. */
function OnboardingGate() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <PageLoader fullScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.onboardedAt) return <Navigate to="/app" replace />;
  return <OnboardingPage />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader fullScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Router and Toaster live in main.tsx - this file owns the route table only.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route
        path="/onboarding"
        element={
          <Suspense fallback={<PageLoader fullScreen />}>
            <OnboardingGate />
          </Suspense>
        }
      />

      {/* Workout mode is a dedicated chrome-free experience - no app shell. */}
      <Route
        path="/app/workout/:sessionId"
        element={
          <Suspense fallback={<PageLoader fullScreen label="Loading your workout" />}>
            <ProtectedRoute>
              <WorkoutPage />
            </ProtectedRoute>
          </Suspense>
        }
      />
      <Route
        path="/app/workout/:sessionId/summary"
        element={
          <Suspense fallback={<PageLoader fullScreen />}>
            <ProtectedRoute>
              <WorkoutSummaryPage />
            </ProtectedRoute>
          </Suspense>
        }
      />

      <Route path="/app" element={<RequireAuth />}>
        <Route index element={<DashboardPage />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="plans/:planId" element={<PlanBuilderPage />} />
        <Route path="exercises" element={<ExerciseLibraryPage />} />
        <Route path="exercises/:idOrSlug" element={<ExerciseDetailPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:sessionId" element={<SessionDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="progress/:exerciseId" element={<ExerciseProgressPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="achievements" element={<AchievementsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
