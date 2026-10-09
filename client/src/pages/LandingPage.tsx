import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarCheck,
  ChartLine,
  Check,
  Dumbbell,
  Flame,
  History,
  ListChecks,
  Moon,
  Play,
  Smartphone,
  Timer,
  Trophy,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { MuscleBadge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/Progress';
import { useAuth } from '@/providers/AuthProvider';

/* ---------------------------------------------------------------------------
 * Landing page.
 *
 * Every section showcases the real product UI - a plan card, a workout in
 * progress, an exercise card, a progress chart - rather than stock imagery.
 * These mocks use the same design tokens as the app itself.
 * ------------------------------------------------------------------------- */

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

function Nav() {
  const { isAuthenticated } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="Forge home">
          <Logo className="size-7" />
          <span className="text-base font-semibold tracking-tight text-text">Forge</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-text-muted md:flex">
          <a href="#how" className="transition-colors hover:text-text">How it works</a>
          <a href="#library" className="transition-colors hover:text-text">Exercise library</a>
          <a href="#progress" className="transition-colors hover:text-text">Progress</a>
          <a href="#faq" className="transition-colors hover:text-text">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Link
              to="/app"
              className="inline-flex h-9 items-center rounded-[var(--radius-control)] bg-accent px-4 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              Open the app
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden h-9 items-center rounded-[var(--radius-control)] px-4 text-sm font-medium text-text-muted transition-colors hover:text-text sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex h-9 items-center rounded-[var(--radius-control)] bg-accent px-4 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
              >
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ----- Product previews ----------------------------------------------------- */

function PreviewFrame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="relative h-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-raised)]">
      {label ? (
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
          <span className="size-2 rounded-full bg-border-strong" aria-hidden />
          <span className="size-2 rounded-full bg-border-strong" aria-hidden />
          <span className="size-2 rounded-full bg-border-strong" aria-hidden />
          <span className="ml-3 text-[11px] font-medium text-text-subtle">{label}</span>
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </div>
  );
}

function PlanPreview() {
  const days = [
    { day: 'Monday', muscles: ['Chest', 'Triceps'], exercises: 6 },
    { day: 'Tuesday', muscles: ['Back', 'Biceps'], exercises: 6 },
    { day: 'Wednesday', rest: true },
    { day: 'Thursday', muscles: ['Legs', 'Abs'], exercises: 7 },
    { day: 'Friday', muscles: ['Chest', 'Shoulders'], exercises: 5 },
  ];
  return (
    <PreviewFrame label="My training week">
      <ul className="space-y-1.5">
        {days.map((d) => (
          <li
            key={d.day}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-surface-inset px-3 py-2"
          >
            <p className="w-16 shrink-0 text-xs font-medium text-text-subtle">{d.day}</p>
            {d.rest ? (
              <p className="min-w-0 flex-1 text-xs text-text-subtle italic">Rest day</p>
            ) : (
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {d.muscles?.map((m) => <MuscleBadge key={m} name={m} size="sm" colorHex="#e0763a" />)}
              </div>
            )}
            {d.exercises ? <span className="tnum shrink-0 text-xs text-text-subtle">{d.exercises} exercises</span> : null}
          </li>
        ))}
      </ul>
    </PreviewFrame>
  );
}

function WorkoutPreview() {
  const sets = [
    { n: 1, w: '60 kg', r: 10, done: true },
    { n: 2, w: '60 kg', r: 10, done: true },
    { n: 3, w: '62.5 kg', r: 8, done: true },
    { n: 4, w: '62.5 kg', r: null, done: false },
  ];
  return (
    <PreviewFrame label="Today's workout - in progress">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text">Bench Press</p>
          <p className="text-xs text-text-subtle">Chest · Barbell · Set 4 of 4</p>
        </div>
        <ProgressRing value={3} max={4} size={42}>3/4</ProgressRing>
      </div>
      <div className="space-y-1.5">
        {sets.map((s) => (
          <div
            key={s.n}
            className={
              s.done
                ? 'flex items-center justify-between rounded-[var(--radius-control)] border border-success/30 bg-success-soft px-3 py-2'
                : 'flex items-center justify-between rounded-[var(--radius-control)] border border-accent/40 bg-accent-soft px-3 py-2'
            }
          >
            <span className="tnum text-sm font-medium text-text">Set {s.n}</span>
            <span className="tnum text-sm text-text">
              {s.w} × {s.r ?? '-'}
            </span>
            {s.done ? (
              <Check className="size-4 text-success" aria-label="Completed" />
            ) : (
              <span className="text-[11px] font-semibold tracking-wide text-accent uppercase">Now</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
        <Timer className="size-3.5" aria-hidden />
        Rest timer 1:30
      </div>
    </PreviewFrame>
  );
}

function ProgressPreview() {
  const points = [22, 30, 26, 38, 44, 42, 55, 60, 66, 71];
  const max = Math.max(...points);
  return (
    <PreviewFrame label="Bench Press - progress">
      <div className="flex items-end gap-1.5" style={{ height: 96 }} aria-hidden>
        {points.map((v, i) => (
          <div key={i} className="flex-1 rounded-t-sm bg-accent/80" style={{ height: `${(v / max) * 100}%`, opacity: 0.35 + (i / points.length) * 0.65 }} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-text-subtle">
        <span>12 weeks</span>
        <span className="font-semibold text-success">+18% volume</span>
      </div>
    </PreviewFrame>
  );
}

function RecordsPreview() {
  return (
    <PreviewFrame label="Personal records">
      <ul className="space-y-2">
        {[
          { name: 'Bench Press', value: '65 kg × 8', was: 'was 62.5 kg × 8' },
          { name: 'Deadlift', value: '140 kg × 5', was: 'was 135 kg × 5' },
        ].map((r) => (
          <li key={r.name} className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border bg-surface-inset px-3 py-2.5">
            <Trophy className="size-4 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{r.name}</p>
              <p className="text-xs text-text-subtle">{r.was}</p>
            </div>
            <span className="tnum text-sm font-semibold text-text">{r.value}</span>
          </li>
        ))}
      </ul>
    </PreviewFrame>
  );
}

/* ----- Sections -------------------------------------------------------------- */

function Hero() {
  const { isAuthenticated } = useAuth();
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" aria-hidden />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 pt-16 pb-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8 lg:pt-14">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted"
          >
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Your personal gym system
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight text-text sm:text-5xl lg:text-[3.4rem]"
          >
            Build your workout.
            <br />
            Track every set.
            <br />
            <span className="text-accent">See your progress.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mt-5 max-w-md text-base leading-relaxed text-text-muted sm:text-lg"
          >
            Forge is a workout planner and tracker that works the way you train. Create any routine - one exercise or
            twenty - log every set on its own, and watch yourself get stronger week after week.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to={isAuthenticated ? '/app' : '/register'}
              className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] bg-accent px-6 text-base font-semibold text-accent-contrast shadow-sm transition-colors hover:bg-accent-hover"
            >
              Start training free
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a
              href="#how"
              className="inline-flex h-12 items-center rounded-[var(--radius-control)] border border-border-strong px-6 text-base font-medium text-text transition-colors hover:bg-surface-hover"
            >
              See how it works
            </a>
          </motion.div>
          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6"
          >
            {[
              ['870+', 'exercises with demos'],
              ['Every set', 'logged on its own'],
              ['Automatic', 'PR detection'],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="text-lg font-semibold text-text">{v}</dt>
                <dd className="mt-0.5 text-xs text-text-subtle">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <WorkoutPreview />
          <div className="absolute -bottom-8 -left-4 hidden w-64 rotate-[-3deg] sm:block lg:-left-10">
            <RecordsPreview />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: ListChecks,
      title: 'Build your plan',
      body: 'Pick your training days, add any muscle groups you want, and choose exercises from a library of 870+. No fixed structure - a day can be one exercise or twenty.',
    },
    {
      icon: Play,
      title: 'Do the workout',
      body: 'Open today\u2019s workout on your phone. See what you lifted last time, log each set independently, add extra sets when you feel strong.',
    },
    {
      icon: ChartLine,
      title: 'Watch yourself improve',
      body: 'Every session is saved as permanent history. Volume, strength trends and personal records are calculated automatically.',
    },
  ];
  return (
    <section id="how" className="border-t border-border bg-bg-subtle py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <motion.div {...fadeUp} className="max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight text-text">One loop: plan, train, progress</h2>
          <p className="mt-3 text-base text-text-muted">
            Your plan is what you intend to do. Your session is what you actually did. Your history is permanent -
            editing next week\u2019s plan never rewrites last week\u2019s workout.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.08 }}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                <step.icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold text-text">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlannerSection() {
  return (
    <section className="py-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">Workout planner</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text">Your routine, not ours</h2>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            Monday chest and triceps, Tuesday back and biceps, Wednesday rest - or three muscle groups in one day, or
            one exercise on its own. There is no enforced split and no limit on muscle groups, exercises or sets per
            day.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              'As many muscle groups per day as you want - or none predefined',
              'Per-exercise targets: sets, rep ranges, weight, rest time',
              'Per-set targets for pyramids and ramp-ups',
              'A weekly cycle that repeats, with per-date overrides',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-text-muted">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div {...fadeUp} className="lg:max-w-md lg:justify-self-end lg:w-full">
          <PlanPreview />
        </motion.div>
      </div>
    </section>
  );
}

function WorkoutSection() {
  return (
    <section className="border-t border-border bg-bg-subtle py-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
        <motion.div {...fadeUp} className="order-2 lg:order-1 lg:max-w-md lg:w-full">
          <WorkoutPreview />
        </motion.div>
        <motion.div {...fadeUp} className="order-1 lg:order-2">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">Workout mode</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text">Built for between sets</h2>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            Workout mode is a different experience from the rest of the app: big touch targets, your last performance
            always visible, a rest timer that starts when you finish a set, and the freedom to add a fifth set when
            the plan said four.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              'Log every set independently - different weight, different reps',
              'Last session\u2019s numbers on screen while you lift',
              'Add extra sets, skip exercises, reorder mid-workout',
              'Rest timer with +30s, skip, pause',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-text-muted">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}

function LibrarySection() {
  const muscles = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Abs'];
  return (
    <section id="library" className="py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">Exercise library</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-text">870+ exercises, each with a demonstration</h2>
            <p className="mt-4 text-base leading-relaxed text-text-muted">
              Every exercise shows a looping visual demo, the muscles it trains, the equipment it needs and step-by-step
              instructions. Search "bench" and every bench variation appears - filtered by muscle, equipment or
              difficulty.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {muscles.map((m) => (
                <MuscleBadge key={m} name={m} colorHex="#e0763a" />
              ))}
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-text-subtle">
                + forearms, traps, calves, cardio…
              </span>
            </div>
            <p className="mt-6 text-sm text-text-muted">
              Can\u2019t find your movement? Create a custom exercise and it works exactly like a library one.
            </p>
          </motion.div>
          <motion.div {...fadeUp} className="grid grid-cols-2 gap-3 lg:max-w-md lg:justify-self-end lg:w-full">
            {[
              { name: 'Bench Press', meta: 'Chest · Barbell', tag: 'Intermediate', slug: 'Barbell_Bench_Press_-_Medium_Grip' },
              { name: 'Lat Pulldown', meta: 'Back · Cable', tag: 'Beginner', slug: 'Wide-Grip_Lat_Pulldown' },
              { name: 'Romanian Deadlift', meta: 'Legs · Barbell', tag: 'Intermediate', slug: 'Romanian_Deadlift' },
              { name: 'Cable Fly', meta: 'Chest · Cable', tag: 'Beginner', slug: 'Flat_Bench_Cable_Flyes' },
            ].map((e) => (
              <div key={e.name} className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
                <ExerciseMedia
                  name={e.name}
                  mode="card"
                  className="aspect-[16/10]"
                  media={{
                    type: 'IMAGE',
                    posterUrl: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${e.slug}/0.jpg`,
                    loopUrl: null,
                    frames: [
                      `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${e.slug}/0.jpg`,
                      `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${e.slug}/1.jpg`,
                    ],
                    isVideo: false,
                    canAnimate: true,
                    hasMedia: true,
                  }}
                />
                <p className="mt-2.5 truncate text-sm font-medium text-text">{e.name}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-text-subtle">{e.meta}</span>
                  <span className="shrink-0 rounded-full bg-surface-inset px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                    {e.tag}
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ProgressSection() {
  return (
    <section id="progress" className="border-t border-border bg-bg-subtle py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-xl text-center">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">Progress</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text">"Am I getting stronger?" - answered</h2>
          <p className="mt-4 text-base text-text-muted">
            Strength progression, weekly volume, muscle-group balance, streaks and personal records - all computed from
            your history, with nothing extra to enter.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <motion.div {...fadeUp}><ProgressPreview /></motion.div>
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }}><RecordsPreview /></motion.div>
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.16 }}>
            <PreviewFrame label="Consistency">
              <div className="flex items-center gap-3.5">
                <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft">
                  <Flame className="size-5 text-accent" aria-hidden />
                </div>
                <div>
                  <p className="tnum text-xl font-semibold text-text">8 days</p>
                  <p className="text-xs text-text-muted">Current streak - rest days count</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1.5" aria-hidden>
                {Array.from({ length: 7 }, (_, i) => (
                  <div
                    key={i}
                    className={i % 4 === 3 ? 'aspect-[4/3] rounded-sm bg-surface-inset' : 'aspect-[4/3] rounded-sm bg-accent/70'}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-text-subtle">Trained 5 of the last 7 days</p>
            </PreviewFrame>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function MobileSection() {
  return (
    <section className="py-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">Mobile first</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text">Made for the gym floor</h2>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            The phone experience is the primary one: large controls you can hit with chalky hands, numbers that don\u2019t
            shift while you type, and everything reachable from your thumb. Desktop gives you the bigger dashboard and
            planning canvas.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              'Steppers sized for one thumb, hold to repeat',
              'Sticky exercise header, set list always in view',
              'Bottom navigation - Home, Plans, Train, Exercises, Progress',
              'Works offline-tolerant: logged sets are never lost',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-text-muted">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div {...fadeUp} className="mx-auto w-72">
          <div className="overflow-hidden rounded-[2rem] border border-border-strong bg-surface shadow-[var(--shadow-overlay)]">
            <div className="border-b border-border px-4 py-3 text-center text-xs font-medium text-text-subtle">Today - Chest + Triceps</div>
            <div className="space-y-2 p-4">
              {['Bench Press', 'Incline DB Press', 'Cable Fly'].map((name, i) => (
                <div key={name} className="flex items-center justify-between rounded-[var(--radius-control)] border border-border bg-surface-inset px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-text">{name}</p>
                    <p className="text-[11px] text-text-subtle">{i === 0 ? '3/4 sets' : i === 1 ? '0/3 sets' : 'planned'}</p>
                  </div>
                  {i === 0 ? (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">NOW</span>
                  ) : (
                    <span className="tnum text-xs text-text-subtle">{i === 1 ? '-' : ''}</span>
                  )}
                </div>
              ))}
              <div className="mt-3 rounded-[var(--radius-control)] bg-accent py-2.5 text-center text-sm font-semibold text-accent-contrast">
                Complete set 4
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: 'Do I have to follow a fixed workout split?',
    a: 'No. A workout day can contain one muscle group, several, or none predefined. Add as many exercises and sets as you like - the plan is yours, not a template.',
  },
  {
    q: 'Does changing my plan rewrite my history?',
    a: 'Never. Plans and completed sessions are separate records. Editing next Monday\u2019s plan leaves every past workout exactly as you logged it.',
  },
  {
    q: 'Can I log a different weight or reps than planned?',
    a: 'That is the whole point. Targets are a starting point; each set is logged independently and you can add extra sets any time.',
  },
  {
    q: 'How are personal records detected?',
    a: 'Automatically on workout completion: heaviest weight, most reps, best set and session volume, and estimated 1RM per exercise. Your first session on an exercise sets the baseline.',
  },
  {
    q: 'Is my data private?',
    a: 'Your workouts, goals, measurements and notes are only visible to your account, enforced on the server. You can delete your account and data at any time.',
  },
  {
    q: 'KG or lb?',
    a: 'Both. Pick your unit once, switch any time - your history stays correct because everything is stored in kilograms and converted only for display.',
  },
];

function Faq() {
  return (
    <section id="faq" className="border-t border-border bg-bg-subtle py-20">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <motion.div {...fadeUp} className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text">Questions, answered</h2>
        </motion.div>
        <dl className="mt-10 space-y-3">
          {FAQS.map((faq, i) => (
            <motion.details
              key={faq.q}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.04 }}
              className="group rounded-[var(--radius-card)] border border-border bg-surface px-5 py-4 open:border-accent/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-text [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ArrowRight className="size-4 shrink-0 rotate-90 text-text-subtle transition-transform group-open:-rotate-90" aria-hidden />
              </summary>
              <dd className="mt-3 text-sm leading-relaxed text-text-muted">{faq.a}</dd>
            </motion.details>
          ))}
        </dl>
      </div>
    </section>
  );
}

function FinalCta() {
  const { isAuthenticated } = useAuth();
  return (
    <section className="relative overflow-hidden py-24">
      <div className="bg-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" aria-hidden />
      <motion.div {...fadeUp} className="relative mx-auto w-full max-w-2xl px-5 text-center sm:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">Your strongest year starts with one set</h2>
        <p className="mt-4 text-base text-text-muted">
          Create your plan, pick your exercises, and log your first workout today.
        </p>
        <Link
          to={isAuthenticated ? '/app' : '/register'}
          className="mt-8 inline-flex h-13 items-center gap-2 rounded-[var(--radius-control)] bg-accent px-8 text-base font-semibold text-accent-contrast shadow-sm transition-colors hover:bg-accent-hover"
        >
          {isAuthenticated ? 'Open the app' : 'Create your account'}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-5 px-5 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2">
          <Logo className="size-5" />
          <span className="text-sm font-medium text-text">Forge</span>
          <span className="text-xs text-text-subtle">- your personal gym system</span>
        </div>
        <div className="flex items-center gap-5 text-xs text-text-subtle">
          <span className="flex items-center gap-1.5"><History className="size-3.5" aria-hidden /> History</span>
          <span className="flex items-center gap-1.5"><Dumbbell className="size-3.5" aria-hidden /> Plans</span>
          <span className="flex items-center gap-1.5"><Trophy className="size-3.5" aria-hidden /> Records</span>
          <span className="flex items-center gap-1.5"><Moon className="size-3.5" aria-hidden /> Rest</span>
          <span className="flex items-center gap-1.5"><CalendarCheck className="size-3.5" aria-hidden /> Schedule</span>
        </div>
        <p className="text-xs text-text-subtle">© {new Date().getFullYear()} Forge</p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <PlannerSection />
        <WorkoutSection />
        <LibrarySection />
        <ProgressSection />
        <MobileSection />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
