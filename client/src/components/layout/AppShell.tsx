import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronDown,
  Dumbbell,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Monitor,
  Moon,
  Play,
  Settings,
  Shield,
  Sun,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { cn } from '@/lib/cn';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/Badge';

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };

const PRIMARY_NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/today', label: "Today's Workout", icon: Play },
  { to: '/app/plans', label: 'Plans', icon: ListChecks },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/exercises', label: 'Exercises', icon: Dumbbell },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/app/progress', label: 'Progress', icon: TrendingUp },
  { to: '/app/history', label: 'History', icon: History },
  { to: '/app/records', label: 'Personal Records', icon: Trophy },
  { to: '/app/goals', label: 'Goals', icon: Target },
];

/** Five is the ceiling for a bottom bar before it stops being tappable. */
const MOBILE_NAV: NavItem[] = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/plans', label: 'Plans', icon: ListChecks },
  { to: '/app/today', label: 'Train', icon: Play },
  { to: '/app/exercises', label: 'Exercises', icon: Dumbbell },
  { to: '/app/progress', label: 'Progress', icon: TrendingUp },
];

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-accent-soft text-accent'
            : 'text-text-muted hover:bg-surface-hover hover:text-text',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-[var(--radius-control)] border border-border bg-surface-inset p-0.5"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          onClick={() => setTheme(value)}
          className={cn(
            'flex size-7 items-center justify-center rounded-[6px] transition-colors',
            theme === value ? 'bg-surface text-text shadow-sm' : 'text-text-subtle hover:text-text',
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  if (!user) return null;
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2.5 rounded-[var(--radius-control)] p-2 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {initials || '?'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">{user.name}</span>
          <span className="block truncate text-xs text-text-subtle">{user.email}</span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute bottom-full left-0 z-20 mb-2 w-full min-w-48 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-raised shadow-[var(--shadow-raised)]"
          >
            <Link
              to="/app/settings"
              role="menuitem"
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <Settings className="size-4" aria-hidden />
              Settings
            </Link>
            {user.role === 'ADMIN' ? (
              <Link
                to="/app/admin"
                role="menuitem"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              >
                <Shield className="size-4" aria-hidden />
                Admin
              </Link>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => void logout()}
              className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-danger"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Persistent banner so an interrupted workout is always one tap from resuming. */
function ActiveSessionBanner() {
  const { data } = useQuery({
    queryKey: qk.activeSession,
    queryFn: () => api.get<{ session: { id: string; title: string } | null }>('/sessions/active'),
    staleTime: 60_000,
  });
  const location = useLocation();
  const session = data?.session;

  if (!session || location.pathname.startsWith('/app/workout')) return null;

  return (
    <Link
      to={`/app/workout/${session.id}`}
      className="flex items-center justify-between gap-3 border-b border-accent/30 bg-accent-soft px-4 py-2.5 text-sm transition-colors hover:brightness-105 lg:px-8"
    >
      <span className="flex min-w-0 items-center gap-2 text-accent">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-accent" />
        </span>
        <span className="truncate font-medium">Workout in progress - {session.title}</span>
      </span>
      <span className="shrink-0 font-medium text-accent">Resume →</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  // Workout mode is a focused, distraction-free surface: no chrome at all.
  const isWorkoutMode = location.pathname.startsWith('/app/workout');
  if (isWorkoutMode) return <>{children}</>;

  return (
    <div className="min-h-dvh bg-bg">
      {/* --- Desktop sidebar ------------------------------------------------ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-bg-subtle lg:flex">
        <div className="px-5 py-5">
          <Link to="/app" className="inline-flex items-center gap-2">
            <Logo className="size-7" />
            <span className="text-base font-semibold tracking-tight text-text">Forge</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          <div className="space-y-0.5">
            {PRIMARY_NAV.map((item) => (
              <NavRow key={item.to} item={item} />
            ))}
          </div>
          <div className="space-y-0.5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">Progress</p>
            {SECONDARY_NAV.map((item) => (
              <NavRow key={item.to} item={item} />
            ))}
          </div>
          {user?.role === 'ADMIN' ? (
            <div className="space-y-0.5">
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">Manage</p>
              <NavRow item={{ to: '/app/admin', label: 'Exercise library', icon: Shield }} />
            </div>
          ) : null}
        </nav>

        <div className="space-y-2 border-t border-border p-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </aside>

      {/* --- Mobile top bar ------------------------------------------------- */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/app" className="inline-flex items-center gap-2">
            <Logo className="size-6" />
            <span className="text-sm font-semibold tracking-tight text-text">Forge</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/app/history"
              aria-label="History"
              className="flex size-10 items-center justify-center rounded-[var(--radius-control)] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <History className="size-4" aria-hidden />
            </Link>
            <Link
              to="/app/settings"
              aria-label="Settings"
              className="flex size-10 items-center justify-center rounded-[var(--radius-control)] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <Settings className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <div className="lg:pl-64">
        <ActiveSessionBanner />
        <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>

      {/* --- Mobile bottom nav --------------------------------------------- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-safe backdrop-blur-md lg:hidden"
      >
        <ul className="flex items-stretch">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const isTrain = item.to === '/app/today';
            return (
              <li key={item.to} className="flex-1">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                      isActive ? 'text-accent' : 'text-text-subtle',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'flex items-center justify-center rounded-full transition-colors',
                          isTrain ? 'size-9 bg-accent text-accent-contrast' : 'size-6',
                          isTrain && isActive && 'bg-accent-hover',
                        )}
                      >
                        <Icon className={isTrain ? 'size-4.5' : 'size-5'} aria-hidden />
                      </span>
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Consistent page header used by every screen inside the shell. */
export function PageHeader({
  title,
  description,
  action,
  badge,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  badge?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">{title}</h1>
          {badge ? <Badge tone="accent">{badge}</Badge> : null}
        </div>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
