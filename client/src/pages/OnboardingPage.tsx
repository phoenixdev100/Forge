import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { ExperienceLevel, FitnessGoal, User } from '@/lib/types';
import type { Unit } from '@/lib/units';
import { useAuth } from '@/providers/AuthProvider';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';

/**
 * Three quick questions, all skippable. The only job here is to calibrate the
 * first-run experience - nothing locks the user into a template.
 */

const GOALS: Array<{ value: FitnessGoal; title: string; body: string }> = [
  { value: 'BUILD_MUSCLE', title: 'Build muscle', body: 'Grow with progressive overload and volume tracking' },
  { value: 'STRENGTH', title: 'Get stronger', body: 'Track the weights and PRs that matter' },
  { value: 'FAT_LOSS', title: 'Lose fat', body: 'Keep training consistent while you cut' },
  { value: 'GENERAL_FITNESS', title: 'General fitness', body: 'Stay active with a routine that fits your week' },
  { value: 'CUSTOM', title: 'Something else', body: 'Set it up your way - nothing is enforced' },
];

const EXPERIENCE: Array<{ value: ExperienceLevel; title: string; body: string }> = [
  { value: 'BEGINNER', title: 'Beginner', body: 'New to structured training' },
  { value: 'INTERMEDIATE', title: 'Intermediate', body: 'Training consistently for a while' },
  { value: 'ADVANCED', title: 'Advanced', body: 'Years of progressive training' },
];

const DAYS = [2, 3, 4, 5, 6];

function OptionCard({
  selected,
  title,
  body,
  onClick,
}: {
  selected: boolean;
  title: string;
  body?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-3.5 text-left transition-colors',
        selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
      )}
    >
      <span>
        <span className={cn('block text-sm font-medium', selected ? 'text-accent' : 'text-text')}>{title}</span>
        {body ? <span className="mt-0.5 block text-xs text-text-muted">{body}</span> : null}
      </span>
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong',
        )}
        aria-hidden
      >
        {selected ? <Check className="size-3" /> : null}
      </span>
    </button>
  );
}

function StepShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-2.5"
    >
      {children}
    </motion.div>
  );
}

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<FitnessGoal | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [unit, setUnit] = useState<Unit>(user?.unit ?? 'KG');
  const [error, setError] = useState<unknown>(null);
  const [isSaving, setIsSaving] = useState(false);

  const steps = ['What are you training for?', 'How experienced are you?', 'How often will you train?'];
  const isLast = step === steps.length - 1;

  async function finish(body: Record<string, unknown> | 'skip') {
    setError(null);
    setIsSaving(true);
    try {
      const { user: updated } =
        body === 'skip'
          ? await api.post<{ user: User }>('/users/me/onboarding/skip')
          : await api.post<{ user: User }>('/users/me/onboarding', body);
      setUser(updated);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setIsSaving(false);
    }
  }

  const submit = () =>
    finish({
      goal,
      experience,
      trainingDaysPerWeek: daysPerWeek,
      unit,
      weekStartsOn: 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

  return (
    <div className="flex min-h-dvh flex-col bg-bg px-5 py-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo className="size-6" />
          <span className="text-sm font-semibold text-text">Forge</span>
        </div>
        <button
          type="button"
          onClick={() => void finish('skip')}
          disabled={isSaving}
          className="text-sm text-text-subtle transition-colors hover:text-text"
        >
          Skip for now
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        {/* Progress dots - three questions, no mystery */}
        <div className="mb-8 flex gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s}
              className={cn('h-1 rounded-full transition-all', i === step ? 'w-8 bg-accent' : 'w-4 bg-border-strong')}
            />
          ))}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-text">{steps[step]}</h1>
        <p className="mt-2 text-sm text-text-muted">
          {step === 0
            ? 'This shapes your dashboard. You can change it later.'
            : step === 1
              ? 'So suggestions match where you actually are.'
              : 'Rest days count toward your streak - training is the plan, not a punishment.'}
        </p>

        {error ? <div className="mt-6"><ErrorState error={error} compact /></div> : null}

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {step === 0 ? (
              <StepShell key="goal">
                {GOALS.map((g) => (
                  <OptionCard key={g.value} title={g.title} body={g.body} selected={goal === g.value} onClick={() => setGoal(g.value)} />
                ))}
              </StepShell>
            ) : step === 1 ? (
              <StepShell key="experience">
                {EXPERIENCE.map((e) => (
                  <OptionCard
                    key={e.value}
                    title={e.title}
                    body={e.body}
                    selected={experience === e.value}
                    onClick={() => setExperience(e.value)}
                  />
                ))}
              </StepShell>
            ) : (
              <StepShell key="schedule">
                <div>
                  <p className="mb-2 text-sm font-medium text-text">Days per week</p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDaysPerWeek(d)}
                        aria-pressed={daysPerWeek === d}
                        className={cn(
                          'tnum flex h-12 w-14 items-center justify-center rounded-[var(--radius-control)] border text-base font-medium transition-colors',
                          daysPerWeek === d
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-border bg-surface text-text hover:border-border-strong',
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <p className="mb-2 text-sm font-medium text-text">Weight unit</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['KG', 'LB'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        aria-pressed={unit === u}
                        className={cn(
                          'h-12 rounded-[var(--radius-control)] border text-sm font-medium transition-colors',
                          unit === u
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-border bg-surface text-text hover:border-border-strong',
                        )}
                      >
                        {u === 'KG' ? 'Kilograms (kg)' : 'Pounds (lb)'}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-text-subtle">
                    Switchable any time - history stays correct either way.
                  </p>
                </div>
              </StepShell>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-10 flex items-center gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} leftIcon={<ArrowLeft className="size-4" />}>
              Back
            </Button>
          ) : null}
          <Button
            size="lg"
            fullWidth
            isLoading={isSaving}
            onClick={() => (isLast ? void submit() : setStep((s) => s + 1))}
            rightIcon={!isLast ? <ArrowRight className="size-4" /> : undefined}
          >
            {isLast ? "Let's go" : 'Continue'}
          </Button>
        </div>
        {isLast ? (
          <p className="mt-3 text-center text-xs text-text-subtle">
            Next step: build your first workout plan.
          </p>
        ) : null}
      </div>
    </div>
  );
}
