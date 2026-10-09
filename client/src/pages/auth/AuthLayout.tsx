import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

/**
 * Split layout: the form gets full attention on the left, while the right
 * panel restates what the product does so the page still sells on its own.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <div className="flex w-full flex-col px-5 py-8 sm:px-8 lg:w-[52%] lg:px-16 lg:py-10">
        <Link to="/" className="inline-flex w-fit items-center gap-2">
          <Logo className="size-7" />
          <span className="text-base font-semibold tracking-tight text-text">Forge</span>
        </Link>

        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-10 lg:mx-auto">
            <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-text-muted">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-6 text-sm text-text-muted">{footer}</div> : null}
          </div>
        </div>
      </div>

      <div className="relative hidden flex-1 border-l border-border bg-bg-subtle lg:block">
        <div className="bg-grid absolute inset-0 opacity-[0.35]" aria-hidden />
        <div className="relative flex h-full flex-col justify-center px-14">
          <blockquote className="max-w-md">
            <p className="text-2xl leading-snug font-semibold tracking-tight text-text">
              Build your workout.
              <br />
              Track every set.
              <br />
              <span className="text-accent">See your progress.</span>
            </p>
            <p className="mt-6 text-sm leading-relaxed text-text-muted">
              Your plan, your exercises, your numbers. Every set you log is kept exactly as you performed it, so you
              can always see what you did last time and how much stronger you have become.
            </p>
          </blockquote>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
            {[
              { value: '870+', label: 'Exercises in the library' },
              { value: 'Every set', label: 'Logged independently' },
              { value: 'Automatic', label: 'PR detection' },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-lg font-semibold text-text">{stat.value}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-text-subtle">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
