import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ChevronLeft, ChevronRight, Pencil, Plus, Search, Upload, Users } from 'lucide-react';
import { api, apiForm, errorMessage, fieldErrors } from '@/lib/api';
import { humanizeEnum } from '@/lib/format';
import { qk } from '@/lib/queryClient';
import type { AdminExerciseRow, Category, Equipment, ExerciseDetail, MuscleGroup, Pagination } from '@/lib/types';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, DifficultyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { TRACKING_LABELS } from '@/lib/tracking';
import type { TrackingType } from '@/lib/types';

const STATUS_TONE = { PUBLISHED: 'success', DRAFT: 'warning', ARCHIVED: 'neutral' } as const;

/* ------------------------- Exercise editor -------------------------------- */

function AdminExerciseEditor({ exercise, open, onClose }: { exercise: AdminExerciseRow | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editing = Boolean(exercise);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [primaryMuscleId, setPrimaryMuscleId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('INTERMEDIATE');
  const [mechanic, setMechanic] = useState<'COMPOUND' | 'ISOLATION' | 'UNKNOWN'>('UNKNOWN');
  const [trackingType, setTrackingType] = useState<TrackingType>('WEIGHT_REPS');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('PUBLISHED');
  const [popularity, setPopularity] = useState(0);
  const [instructions, setInstructions] = useState('');
  const [mistakes, setMistakes] = useState('');
  const [tips, setTips] = useState('');
  const [breathing, setBreathing] = useState('');
  const [aliases, setAliases] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  // Populate when editing opens.
  useEffect(() => {
    if (!open || !exercise) return;
    void (async () => {
      const { exercise: full } = await api.get<{ exercise: ExerciseDetail }>(`/exercises/${exercise.id}`);
      setName(full.name);
      setDescription(full.description ?? '');
      setPrimaryMuscleId(full.primaryMuscle.id);
      setEquipmentId(full.equipment?.id ?? '');
      setCategoryId(full.category?.id ?? '');
      setDifficulty(full.difficulty);
      setMechanic(full.mechanic);
      setTrackingType(full.trackingType);
      setStatus(exercise.status);
      setPopularity(full.popularity ?? 0);
      setInstructions(full.instructions.join('\n'));
      setMistakes(full.commonMistakes.join('\n'));
      setTips(full.tips.join('\n'));
      setBreathing(full.breathing ?? '');
      setAliases(full.aliases.join(', '));
    })();
  }, [open, exercise]);

  const { data: tax } = useQuery({
    queryKey: ['admin-taxonomy'],
    queryFn: async () => {
      const [muscles, equipment, categories] = await Promise.all([
        api.get<{ muscleGroups: MuscleGroup[] }>('/muscle-groups'),
        api.get<{ equipment: Equipment[] }>('/library/equipment'),
        api.get<{ categories: Category[] }>('/library/categories'),
      ]);
      return { muscles: muscles.muscleGroups, equipment: equipment.equipment, categories: categories.categories };
    },
    enabled: open,
    staleTime: 10 * 60_000,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        primaryMuscleId,
        equipmentId: equipmentId || null,
        categoryId: categoryId || null,
        difficulty,
        mechanic,
        trackingType,
        status,
        popularity,
        instructions: instructions.split('\n').map((l) => l.trim()).filter(Boolean),
        commonMistakes: mistakes.split('\n').map((l) => l.trim()).filter(Boolean),
        tips: tips.split('\n').map((l) => l.trim()).filter(Boolean),
        breathing: breathing.trim() || null,
        aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
        mediaAssetId,
        mediaType: mediaAssetId ? 'IMAGE' : undefined,
      };
      return editing
        ? api.patch(`/admin/exercises/${exercise!.id}`, body)
        : api.post('/admin/exercises', body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      toast.success(editing ? 'Exercise updated.' : 'Exercise published to the library.');
      onClose();
    },
    onError: setError,
  });

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('files', files[0]!);
      const { assets } = await apiForm<{ assets: Array<{ id: string; url: string }> }>('/admin/media', form);
      setMediaAssetId(assets[0]!.id);
      setMediaPreview(assets[0]!.url);
      toast.success('Media uploaded.');
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  }

  const errors = fieldErrors(error);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Edit "${exercise!.name}"` : 'New library exercise'}
      variant="sheet"
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => save.mutate()} isLoading={save.isPending} disabled={!name.trim() || !primaryMuscleId}>
            {editing ? 'Save changes' : 'Create exercise'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <p role="alert" className="text-sm text-danger">{errorMessage(error)}</p> : null}
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors['name']} required />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Primary muscle" value={primaryMuscleId} onChange={(e) => setPrimaryMuscleId(e.target.value)} error={errors['primaryMuscleId']} required>
            <option value="" disabled>Pick muscle</option>
            {(tax?.muscles ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select label="Equipment" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
            <option value="">None</option>
            {(tax?.equipment ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">None</option>
            {(tax?.categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </Select>
          <Select label="Mechanic" value={mechanic} onChange={(e) => setMechanic(e.target.value as typeof mechanic)}>
            <option value="COMPOUND">Compound</option>
            <option value="ISOLATION">Isolation</option>
            <option value="UNKNOWN">Unknown</option>
          </Select>
          <Select label="Tracking" value={trackingType} onChange={(e) => setTrackingType(e.target.value as TrackingType)}>
            {Object.entries(TRACKING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Input label="Popularity" type="number" min={0} value={popularity} onChange={(e) => setPopularity(Number(e.target.value))} />
        </div>

        {/* Media upload */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-text">Demo media</p>
          <div className="flex items-center gap-3">
            {mediaPreview || exercise?.thumbnailUrl ? (
              <img src={mediaPreview ?? exercise?.thumbnailUrl ?? ''} alt="" className="size-16 rounded-[var(--radius-control)] border border-border object-cover" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-border-strong text-text-subtle">
                <Upload className="size-5" aria-hidden />
              </div>
            )}
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-hover">
              <Upload className="size-4" aria-hidden />
              {uploading ? 'Uploading…' : 'Upload image/video'}
              <input type="file" accept="image/*,video/mp4,video/webm" className="sr-only" onChange={(e) => void handleUpload(e.target.files)} disabled={uploading} />
            </label>
          </div>
        </div>

        <Textarea label="Instructions (one per line)" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Textarea label="Common mistakes (one per line)" value={mistakes} onChange={(e) => setMistakes(e.target.value)} rows={3} />
          <Textarea label="Tips (one per line)" value={tips} onChange={(e) => setTips(e.target.value)} rows={3} />
        </div>
        <Input label="Breathing guidance" value={breathing} onChange={(e) => setBreathing(e.target.value)} placeholder="Brace, exhale on the way up…" />
        <Input label="Aliases (comma separated)" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="bench press, barbell bench" />
      </div>
    </Dialog>
  );
}

/* ------------------------------- The page --------------------------------- */

export default function AdminPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminExerciseRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AdminExerciseRow | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: stats } = useQuery({
    queryKey: qk.adminStats,
    queryFn: () => api.get<{ users: number; libraryExercises: number; completedSessions: number; customExercises: number }>('/admin/stats'),
  });

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.adminExercises({ q: debounced, status, page }),
    queryFn: () =>
      api.get<{ exercises: AdminExerciseRow[]; pagination: Pagination }>('/admin/exercises', {
        query: { q: debounced || undefined, status: status || undefined, page, pageSize: 20 },
      }),
    placeholderData: (p) => p,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<{ archived: boolean }>(`/admin/exercises/${id}`),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success(r.archived ? 'Archived - it stays in users\u2019 history.' : 'Deleted.');
      setArchiveTarget(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Exercise library management - add and maintain movements without touching code."
        action={<Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="size-4" />}>New exercise</Button>}
      />

      {stats ? (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Users', stats.users],
            ['Library exercises', stats.libraryExercises],
            ['Sessions logged', stats.completedSessions],
            ['Custom exercises', stats.customExercises],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardBody className="py-4">
                <p className="tnum text-2xl font-semibold text-text">{value}</p>
                <p className="mt-0.5 text-xs text-text-subtle">{label}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search exercises…"
            aria-label="Search library exercises"
            className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-inset pr-3 pl-9 text-sm text-text focus:border-accent focus:outline-none"
          />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} containerClassName="w-40" aria-label="Status">
          <option value="">Any status</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </div>

      {isPending ? (
        <ul className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</ul>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.exercises.length ? (
        <EmptyState icon={<Users className="size-5" />} title="Nothing matches" description="Try a different search or status." />
      ) : (
        <>
          <ul className="space-y-2">
            {data.exercises.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2.5 sm:px-4">
                {e.thumbnailUrl ? (
                  <img src={e.thumbnailUrl} alt="" className="size-10 shrink-0 rounded-[var(--radius-control)] object-cover" loading="lazy" />
                ) : (
                  <div className="size-10 shrink-0 rounded-[var(--radius-control)] bg-surface-inset" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-text">{e.name}</p>
                    <Badge size="sm" tone={STATUS_TONE[e.status]}>{humanizeEnum(e.status)}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-text-subtle">
                    {e.primaryMuscle.name}
                    {e.equipment ? ` · ${e.equipment.name}` : ''}
                    {' · '}{e.timesPerformed} performed
                  </p>
                </div>
                <DifficultyBadge difficulty={e.difficulty} />
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${e.name}`} onClick={() => setEditing(e)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Archive ${e.name}`} className="text-text-subtle hover:text-danger" onClick={() => setArchiveTarget(e)}>
                    <Archive className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {data.pagination.totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-text-subtle tnum">
                {data.pagination.total} exercises
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} leftIcon={<ChevronLeft className="size-4" />}>Prev</Button>
                <Button variant="secondary" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} rightIcon={<ChevronRight className="size-4" />}>Next</Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {editing ? <AdminExerciseEditor exercise={editing} open onClose={() => setEditing(null)} /> : null}
      <AdminExerciseEditor exercise={null} open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && remove.mutate(archiveTarget.id)}
        isLoading={remove.isPending}
        title={`Archive "${archiveTarget?.name}"?`}
        description="It disappears from the library but stays in users' workout history."
        confirmLabel="Archive"
      />
    </div>
  );
}
