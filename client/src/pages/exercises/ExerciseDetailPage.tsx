import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  ListPlus,
  Pencil,
  Repeat,
  StickyNote,
  Timer,
  Trash2,
  TrendingUp,
  Wind,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { humanizeEnum, formatTimeAgo } from '@/lib/format';
import { qk } from '@/lib/queryClient';
import { TRACKING_LABELS, tracksWeight } from '@/lib/tracking';
import type { ExerciseDetail } from '@/lib/types';
import { toast } from 'sonner';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { Badge, DifficultyBadge, MuscleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Input';
import { ErrorState, PageLoader } from '@/components/ui/States';
import { CreateExerciseDialog } from './CreateExerciseDialog';
import { AddToPlanDialog } from './AddToPlanDialog';
import { OneRmCalculator } from '@/components/workout/OneRmCalculator';
import { useUnit } from '@/providers/AuthProvider';

function InstructionList({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className={ordered ? 'space-y-3' : 'space-y-2'}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-text-muted">
          {ordered ? (
            <span className="tnum mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
              {i + 1}
            </span>
          ) : (
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden />
          )}
          <span>{item}</span>
        </li>
      ))}
    </List>
  );
}

export default function ExerciseDetailPage() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [oneRmOpen, setOneRmOpen] = useState(false);
  const unit = useUnit();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.exercise(idOrSlug!),
    queryFn: () => api.get<{ exercise: ExerciseDetail; note: { body: string; updatedAt: string } | null }>(`/exercises/${idOrSlug}`),
    enabled: Boolean(idOrSlug),
  });

  const saveNote = useMutation({
    // The URL may hold a slug; notes are keyed by the exercise's real id.
    mutationFn: (body: string) => api.put(`/exercises/${data?.exercise.id}/note`, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.exercise(idOrSlug!) });
      setNoteOpen(false);
      toast.success('Note saved.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete<{ archived: boolean }>(`/exercises/${data?.exercise.id}`),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      toast.success(result.archived ? 'Exercise archived - it stays in your history.' : 'Exercise deleted.');
      navigate('/app/exercises');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isPending) return <PageLoader label="Loading exercise" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { exercise, note } = data;
  const owned = exercise.isCustom;

  return (
    <div>
      <Link to="/app/exercises" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Exercise library
      </Link>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* Media column */}
        <div>
          <ExerciseMedia media={exercise.media} name={exercise.name} mode="detail" className="aspect-square w-full" rounded />
          {exercise.mediaAttribution ? (
            <p className="mt-2 text-[11px] text-text-subtle">{exercise.mediaAttribution}</p>
          ) : null}

          {/* Fact sheet */}
          <Card className="mt-4">
            <CardBody className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
              <div>
                <p className="text-xs text-text-subtle">Primary muscle</p>
                <MuscleBadge name={exercise.primaryMuscle.name} colorHex={exercise.primaryMuscle.colorHex} size="sm" className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-text-subtle">Secondary</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {exercise.secondaryMuscles.length ? (
                    exercise.secondaryMuscles.map((m) => <MuscleBadge key={m.id} name={m.name} colorHex={m.colorHex} size="sm" />)
                  ) : (
                    <span className="text-sm text-text-muted">-</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-text-subtle">Equipment</p>
                <p className="mt-1 font-medium text-text">{exercise.equipment?.name ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-text-subtle">Difficulty</p>
                <div className="mt-1">
                  <DifficultyBadge difficulty={exercise.difficulty} />
                </div>
              </div>
              <div>
                <p className="text-xs text-text-subtle">Movement</p>
                <p className="mt-1 font-medium text-text">{humanizeEnum(exercise.movementType)}</p>
              </div>
              <div>
                <p className="text-xs text-text-subtle">Tracked as</p>
                <p className="mt-1 font-medium text-text">{TRACKING_LABELS[exercise.trackingType]}</p>
              </div>
              <div>
                <p className="text-xs text-text-subtle">Default rest</p>
                <p className="mt-1 flex items-center gap-1 font-medium text-text">
                  <Timer className="size-3.5 text-text-subtle" aria-hidden /> {exercise.defaultRestSeconds}s
                </p>
              </div>
              <div>
                <p className="text-xs text-text-subtle">Mechanic</p>
                <p className="mt-1 font-medium text-text">{humanizeEnum(exercise.mechanic)}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Content column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">{exercise.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={exercise.difficulty} size="md" />
                {exercise.isUnilateral ? <Badge size="md" tone="info">Each side</Badge> : null}
                {exercise.isCustom ? <Badge size="md" tone="accent">Your exercise</Badge> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {tracksWeight(exercise.trackingType) ? (
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-12"
                  aria-label="Open 1RM calculator"
                  onClick={() => setOneRmOpen(true)}
                >
                  <Calculator className="size-4" />
                </Button>
              ) : null}
              <Button size="lg" onClick={() => setAddOpen(true)} leftIcon={<ListPlus className="size-4" />}>
                Add to plan
              </Button>
              {owned ? (
                <>
                  <Button variant="secondary" size="icon" aria-label="Edit exercise" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete exercise" className="text-danger hover:text-danger" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="size-4" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {exercise.description ? <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-muted">{exercise.description}</p> : null}

          {exercise.aliases.length ? (
            <p className="mt-2 text-xs text-text-subtle">Also known as: {exercise.aliases.join(', ')}</p>
          ) : null}

          <div className="mt-8 space-y-6">
            {exercise.instructions.length ? (
              <Card>
                <CardHeader title="How to perform it" icon={<Check className="size-4" />} />
                <CardBody className="pt-4">
                  <InstructionList items={exercise.instructions} ordered />
                </CardBody>
              </Card>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              {exercise.commonMistakes.length ? (
                <Card>
                  <CardHeader title="Common mistakes" icon={<AlertTriangle className="size-4" />} />
                  <CardBody className="pt-4">
                    <InstructionList items={exercise.commonMistakes} />
                  </CardBody>
                </Card>
              ) : null}
              {exercise.tips.length ? (
                <Card>
                  <CardHeader title="Training tips" icon={<TrendingUp className="size-4" />} />
                  <CardBody className="pt-4">
                    <InstructionList items={exercise.tips} />
                  </CardBody>
                </Card>
              ) : null}
            </div>

            {exercise.breathing ? (
              <Card>
                <CardHeader title="Breathing" icon={<Wind className="size-4" />} />
                <CardBody className="pt-4">
                  <p className="text-sm leading-relaxed text-text-muted">{exercise.breathing}</p>
                </CardBody>
              </Card>
            ) : null}

            {/* Personal note - private to this user */}
            <Card>
              <CardHeader
                title="My note"
                description="Private to you - grip cues, machine settings, anything."
                icon={<StickyNote className="size-4" />}
                action={
                  <Button variant="ghost" size="sm" onClick={() => { setNoteDraft(note?.body ?? ''); setNoteOpen(true); }}>
                    {note ? 'Edit' : 'Add note'}
                  </Button>
                }
              />
              {note ? (
                <CardBody className="pt-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-text-muted">{note.body}</p>
                  <p className="mt-2 text-xs text-text-subtle">Updated {formatTimeAgo(note.updatedAt)}</p>
                </CardBody>
              ) : null}
            </Card>

            <Card>
              <CardBody className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-sm text-text-muted">
                  <Repeat className="size-4 text-text-subtle" aria-hidden />
                  See how your numbers on this exercise have moved over time.
                </div>
                <Link to={`/app/progress/${exercise.id}`} className="shrink-0 text-sm font-medium text-accent hover:underline">
                  View progress →
                </Link>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <AddToPlanDialog exercise={exercise} open={addOpen} onClose={() => setAddOpen(false)} />

      {oneRmOpen ? (
        <OneRmCalculator open={oneRmOpen} onClose={() => setOneRmOpen(false)} unit={unit} />
      ) : null}

      <Dialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="My note"
        variant="sheet"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => saveNote.mutate(noteDraft ?? '')} isLoading={saveNote.isPending}>Save note</Button>
          </>
        }
      >
        <Textarea
          label="Note"
          value={noteDraft ?? ''}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={4}
          placeholder='e.g. "Seat height 3 on our gym machine", "squeeze at the top"'
          data-autofocus
        />
        <p className="mt-2 text-xs text-text-subtle">Saving an empty note deletes it.</p>
      </Dialog>

      {owned ? (
        <CreateExerciseDialog open={editOpen} onClose={() => setEditOpen(false)} exercise={exercise} />
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
        isLoading={remove.isPending}
        title={`Delete "${exercise.name}"?`}
        description="If this exercise appears in your history it will be archived instead - your workouts keep their records."
        confirmLabel="Delete exercise"
      />
    </div>
  );
}
