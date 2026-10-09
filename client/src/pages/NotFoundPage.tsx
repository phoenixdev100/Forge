import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <Logo className="size-10 opacity-60" />
      <p className="mt-6 text-xs font-semibold tracking-widest text-text-subtle uppercase">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">This page wandered off</h1>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        The link may be old, or the page was moved. Your workouts are exactly where you left them.
      </p>
      <Link
        to="/app"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-accent px-5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
      >
        <Compass className="size-4" aria-hidden />
        Back to dashboard
      </Link>
    </div>
  );
}
