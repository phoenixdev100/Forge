import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Dumbbell, LayoutGrid, List, ListChecks, MoreVertical, Moon, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { qk } from '@/lib/queryClient';
import type { PlanSummary, PlanTemplate } from '@/lib/types';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, MuscleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States';
import { cn } from '@/lib/cn';

const CYCLE_LENGTHS = [
  { value: 7, label: 'Weekly (7 days)' },
  { value: 14, label: 'Fortnightly (14 days)' },
  { value: 10, label: '10-day cycle' },
  { value: 5, label: '5-day cycle' },
];

/**
 * New-plan dialog: start blank or from a template. Templates are a starting
 * point - every copied day stays fully editable afterwards.
 */
function CreatePlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cycleLength, setCycleLength] = useState(7);
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);

  const { data: templateData } = useQuery({
    queryKey: qk.templates,
    queryFn: () => api.get<{ templates: PlanTemplate[] }>('/plans/templates'),
    enabled: open,
    staleTime: 10 * 60_000,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<{ plan: { id: string } }>('/plans', {
        name: name.trim() || 'My training plan',
        description: description.trim() || null,
        cycleLength,
        activate: true,
        templateSlug: templateSlug ?? undefined,
      }),
    onSuccess: ({ plan }) => {
      void queryClient.invalidateQueries({ queryKey: qk.plans });
      toast.success('Plan created - add your exercises.');
      onClose();
      navigate(`/app/plans/${plan.id}`);
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not create the plan.')),
  });

  const templates = templateData?.templates ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create a workout plan"
      description="A weekly cycle by default - change the length for rotating splits. Everything stays editable."
      variant="sheet"
      size="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => create.mutate()} isLoading={create.isPending}>Create plan</Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Left - the plan itself */}
        <div className="space-y-3">
          <Input
            label="Plan name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Push Pull Legs, or My routine"
            data-autofocus
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this plan for?"
            rows={2}
          />
          <Select label="Cycle length" value={cycleLength} onChange={(e) => setCycleLength(Number(e.target.value))}>
            {CYCLE_LENGTHS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface-inset px-3 py-2.5">
            <p className="text-xs leading-relaxed text-text-muted">
              A template prefills days, exercises and set targets - <span className="text-text">everything stays editable</span> in
              the builder, including after workouts are logged.
            </p>
          </div>
        </div>

        {/* Right - templates, scrollable on their own so the page never scrolls */}
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold tracking-wide text-text-subtle uppercase">Start from a template</p>
          <div className="grid content-start gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTemplateSlug(null)}
              aria-pressed={templateSlug === null}
              className={cn(
                'rounded-[var(--radius-card)] border px-3 py-2 text-left transition-colors',
                templateSlug === null ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong',
              )}
            >
              <p className={cn('text-sm font-medium', templateSlug === null ? 'text-accent' : 'text-text')}>Blank plan</p>
              <p className="mt-0.5 text-xs text-text-muted">Empty days, built entirely your way.</p>
            </button>
            {templates.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => setTemplateSlug(t.slug)}
                aria-pressed={templateSlug === t.slug}
                className={cn(
                  'rounded-[var(--radius-card)] border px-3 py-2.5 text-left transition-colors',
                  templateSlug === t.slug ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong',
                )}
              >
                <p className={cn('flex items-center gap-1.5 text-sm font-medium', templateSlug === t.slug ? 'text-accent' : 'text-text')}>
                  <Sparkles className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{t.name}</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{t.description}</p>
                <p className="mt-1 text-[11px] text-text-subtle">{t.daysPerWeek} days/week</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function PlanMenu({ plan, onDelete }: { plan: PlanSummary; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const activate = useMutation({
    mutationFn: () => api.post(`/plans/${plan.id}/activate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.plans });
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
      void queryClient.invalidateQueries({ queryKey: qk.dashboard });
      toast.success(`"${plan.name}" is now your active plan.`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const duplicate = useMutation({
    mutationFn: () => api.post(`/plans/${plan.id}/duplicate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.plans });
      toast.success('Plan duplicated.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/plans/${plan.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.plans });
      toast.success('Plan deleted.');
      onDelete();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" aria-label={`Options for ${plan.name}`} onClick={() => setOpen((v) => !v)}>
        <MoreVertical className="size-4" />
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-raised shadow-[var(--shadow-raised)]">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              onClick={() => { setOpen(false); navigate(`/app/plans/${plan.id}`); }}
            >
              <Pencil className="size-4" aria-hidden /> Edit plan
            </button>
            {!plan.isActive ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                onClick={() => { setOpen(false); activate.mutate(); }}
              >
                <ListChecks className="size-4" aria-hidden /> Make active
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              onClick={() => { setOpen(false); duplicate.mutate(); }}
            >
              <Copy className="size-4" aria-hidden /> Duplicate
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-danger"
              onClick={() => { setOpen(false); setConfirmDelete(true); }}
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </button>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        isLoading={remove.isPending}
        title={`Delete "${plan.name}"?`}
        description="Your workout history stays intact - this only removes the plan going forward."
        confirmLabel="Delete plan"
      />
    </div>
  );
}

const VIEW_KEY = 'forge.plansView';
type PlansView = 'cards' | 'list';

export default function PlansPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setViewState] = useState<PlansView>(() =>
    localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards',
  );
  const setView = (v: PlansView) => {
    setViewState(v);
    localStorage.setItem(VIEW_KEY, v);
  };
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.plans,
    queryFn: () => api.get<{ plans: PlanSummary[] }>('/plans'),
  });

  return (
    <div>
      <PageHeader
        title="Workout plans"
        description="Your recurring routines. The active plan fills your schedule and today's workout."
        action={
          <>
            {data?.plans.length ? (
              <div className="flex rounded-[var(--radius-control)] border border-border bg-surface p-0.5" role="group" aria-label="Change view">
                {(
                  [
                    ['cards', LayoutGrid, 'Card view'],
                    ['list', List, 'List view'],
                  ] as const
                ).map(([v, Icon, label]) => (
                  <button
                    key={v}
                    type="button"
                    title={label}
                    aria-pressed={view === v}
                    aria-label={label}
                    onClick={() => setView(v)}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-md transition-colors',
                      view === v ? 'bg-surface-inset text-text' : 'text-text-subtle hover:text-text',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                ))}
              </div>
            ) : null}
            <Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="size-4" />} className="max-sm:order-first max-sm:mr-auto">New plan</Button>
          </>
        }
      />

      {isPending ? (
        <PageLoader label="Loading your plans" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.plans.length ? (
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="No workout plan yet"
          description="Create your first plan to schedule your training week. Start blank or from a template - every part of it stays editable."
          action={<Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="size-4" />}>Create a plan</Button>}
        />
      ) : view === 'list' ? (
        <Card>
          <ul className="divide-y divide-border">
            {data.plans.map((plan) => (
              <li key={plan.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/app/plans/${plan.id}`} className="truncate text-sm font-medium text-text hover:text-accent">
                      {plan.name}
                    </Link>
                    {plan.isActive ? <Badge tone="accent" size="sm">Active</Badge> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-subtle">
                    {plan.workoutDayCount} training days · {plan.exerciseCount} exercises · {plan.cycleLength}-day cycle
                    {plan.startsOn ? ` · since ${formatDate(plan.startsOn)}` : ''}
                  </p>
                </div>
                {plan.description ? (
                  <p className="hidden w-56 truncate text-xs text-text-muted lg:block">{plan.description}</p>
                ) : null}
                <PlanMenu plan={plan} onDelete={() => void refetch()} />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.plans.map((plan) => (
            <li key={plan.id}>
              <Card interactive className="h-full">
                <div className="flex h-full flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/app/plans/${plan.id}`} className="truncate text-sm font-semibold text-text hover:text-accent">
                          {plan.name}
                        </Link>
                        {plan.isActive ? <Badge tone="accent" size="sm">Active</Badge> : null}
                      </div>
                      {plan.description ? <p className="mt-0.5 truncate text-xs text-text-muted">{plan.description}</p> : null}
                    </div>
                    <PlanMenu plan={plan} onDelete={() => void refetch()} />
                  </div>

                  <p className="tnum mt-2 text-xs text-text-subtle">
                    {plan.workoutDayCount} days · {plan.exerciseCount} exercises · {plan.cycleLength}-day cycle
                  </p>

                  {/* The week at a glance */}
                  <div className="mt-3 space-y-1">
                    {Array.from({ length: Math.min(plan.cycleLength, 7) }, (_, i) => {
                      const day = plan.days.find((d) => d.position === i);
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface-inset px-2.5 py-1.5"
                        >
                          <span className="w-9 shrink-0 text-[10px] font-medium tracking-wide text-text-subtle uppercase">
                            {plan.cycleLength === 7 ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] : `D${i + 1}`}
                          </span>
                          {day && day.dayType !== 'REST' ? (
                            <>
                              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                                {day.muscleGroups.slice(0, 3).map((m) => (
                                  <MuscleBadge key={m.id} name={m.name} colorHex={m.colorHex} size="sm" />
                                ))}
                                {day.muscleGroups.length > 3 ? (
                                  <span className="text-[11px] text-text-subtle">+{day.muscleGroups.length - 3}</span>
                                ) : null}
                                {!day.muscleGroups.length ? (
                                  <span className="text-xs text-text-muted">{day.label ?? 'Custom workout'}</span>
                                ) : null}
                              </div>
                              <span className="tnum shrink-0 text-[11px] text-text-subtle">{day.exerciseCount} ex</span>
                            </>
                          ) : (
                            <span className="flex flex-1 items-center gap-1.5 text-xs text-text-subtle">
                              <Moon className="size-3" aria-hidden /> Rest
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex gap-2 border-t border-border pt-3">
                    <Link
                      to={`/app/plans/${plan.id}`}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-border text-xs font-medium text-text transition-colors hover:bg-surface-hover"
                    >
                      <Dumbbell className="size-3.5" aria-hidden /> Edit plan
                    </Link>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CreatePlanDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
