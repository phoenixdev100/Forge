import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { TRACKING_LABELS } from '@/lib/tracking';
import type { Category, Equipment, ExerciseDetail, MuscleGroup, TrackingType } from '@/lib/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

const TRACKING_TYPES = Object.keys(TRACKING_LABELS) as TrackingType[];

/**
 * Custom exercises are first-class: once created they appear in the library,
 * in pickers, and work exactly like built-in exercises.
 */
export function CreateExerciseDialog({
  open,
  onClose,
  exercise,
}: {
  open: boolean;
  onClose: () => void;
  /** Pass an existing custom exercise to edit it. */
  exercise?: ExerciseDetail | null;
}) {
  const queryClient = useQueryClient();
  const editing = Boolean(exercise);

  const [name, setName] = useState(exercise?.name ?? '');
  const [primaryMuscleId, setPrimaryMuscleId] = useState(exercise?.primaryMuscle.id ?? '');
  const [secondaryMuscleIds, setSecondaryMuscleIds] = useState<string[]>(
    exercise?.secondaryMuscles?.map((m) => m.id) ?? [],
  );
  const [equipmentId, setEquipmentId] = useState(exercise?.equipment?.id ?? '');
  const [categoryId, setCategoryId] = useState(exercise?.category?.id ?? '');
  const [difficulty, setDifficulty] = useState(exercise?.difficulty ?? 'INTERMEDIATE');
  const [mechanic, setMechanic] = useState(exercise?.mechanic ?? 'UNKNOWN');
  const [trackingType, setTrackingType] = useState<TrackingType>(exercise?.trackingType ?? 'WEIGHT_REPS');
  const [description, setDescription] = useState(exercise?.description ?? '');
  const [instructions, setInstructions] = useState((exercise?.instructions ?? []).join('\n'));
  const [rest, setRest] = useState<number>(exercise?.defaultRestSeconds ?? 90);
  const [error, setError] = useState<unknown>(null);

  const { data: muscleData } = useQuery({
    queryKey: qk.muscleGroups(),
    queryFn: () => api.get<{ muscleGroups: MuscleGroup[] }>('/muscle-groups'),
    enabled: open,
    staleTime: 10 * 60_000,
  });
  const { data: equipmentData } = useQuery({
    queryKey: qk.equipment,
    queryFn: () => api.get<{ equipment: Equipment[] }>('/library/equipment'),
    enabled: open,
    staleTime: 10 * 60_000,
  });
  const { data: categoryData } = useQuery({
    queryKey: qk.categories,
    queryFn: () => api.get<{ categories: Category[] }>('/library/categories'),
    enabled: open,
    staleTime: 10 * 60_000,
  });

  const muscles = muscleData?.muscleGroups ?? [];
  const errors = fieldErrors(error);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        primaryMuscleId,
        secondaryMuscleIds: secondaryMuscleIds.length ? secondaryMuscleIds : undefined,
        equipmentId: equipmentId || null,
        categoryId: categoryId || null,
        difficulty,
        mechanic,
        trackingType,
        defaultRestSeconds: rest,
        instructions: instructions.split('\n').map((l) => l.trim()).filter(Boolean),
      };
      return editing
        ? api.patch<{ exercise: ExerciseDetail }>(`/exercises/${exercise!.id}`, body)
        : api.post<{ exercise: ExerciseDetail }>('/exercises', body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      toast.success(editing ? 'Exercise updated.' : `"${name.trim()}" added to your exercises.`);
      onClose();
    },
    onError: setError,
  });

  const toggleSecondary = (id: string) =>
    setSecondaryMuscleIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id].slice(0, 8)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${exercise!.name}` : 'Create a custom exercise'}
      description="Custom exercises behave exactly like library ones - pickable everywhere, logged the same way."
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

        <Input
          label="Exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors['name']}
          required
          placeholder="e.g. Cable chest press"
          data-autofocus
        />

        <Select
          label="Primary muscle"
          value={primaryMuscleId}
          onChange={(e) => setPrimaryMuscleId(e.target.value)}
          error={errors['primaryMuscleId']}
          required
        >
          <option value="" disabled>Pick the muscle this mainly trains</option>
          {muscles.map((m) => (
            <option key={m.id} value={m.id}>{m.parentId ? '  ' : ''}{m.name}</option>
          ))}
        </Select>

        <div>
          <p className="mb-1.5 text-sm font-medium text-text">Secondary muscles (optional)</p>
          <div className="flex flex-wrap gap-1.5">
            {muscles
              .filter((m) => m.id !== primaryMuscleId)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleSecondary(m.id)}
                  aria-pressed={secondaryMuscleIds.includes(m.id)}
                  className={cn(
                    'h-7 rounded-full border px-2.5 text-xs font-medium transition-colors',
                    secondaryMuscleIds.includes(m.id)
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-text-muted hover:border-border-strong',
                  )}
                >
                  {m.name}
                </button>
              ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Equipment" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
            <option value="">None / other</option>
            {(equipmentData?.equipment ?? []).map((eq) => (
              <option key={eq.id} value={eq.id}>{eq.name}</option>
            ))}
          </Select>
          <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorised</option>
            {(categoryData?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
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
        </div>

        <Select
          label="How is it tracked?"
          value={trackingType}
          onChange={(e) => setTrackingType(e.target.value as TrackingType)}
          hint="Decides which inputs appear in workout mode - a plank asks for seconds."
        >
          {TRACKING_TYPES.map((t) => (
            <option key={t} value={t}>{TRACKING_LABELS[t]}</option>
          ))}
        </Select>

        <Input
          label="Default rest (seconds)"
          type="number"
          inputMode="numeric"
          min={0}
          max={1800}
          value={rest}
          onChange={(e) => setRest(Number(e.target.value))}
        />

        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <Textarea
          label="Instructions (optional - one per line)"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={4}
          placeholder={'Set up the bench\nGrip slightly wider than shoulders\nLower with control'}
        />
      </div>
    </Dialog>
  );
}
