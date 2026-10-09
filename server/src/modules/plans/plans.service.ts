import type { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { parseIsoDate } from '../../lib/dates.js';
import { PlanDayType, PublishStatus } from '../../generated/prisma/enums.js';
import { planDaySelect, planSelect, serializePlan, serializePlanDay, serializePlanExercise } from './plans.serializer.js';
import { planExerciseSelect } from './plans.serializer.js';
import type {
  addPlanExerciseSchema,
  addPlanExercisesSchema,
  createDaySchema,
  createPlanSchema,
  setPlannedSetsSchema,
  updateDaySchema,
  updatePlanExerciseSchema,
  updatePlanSchema,
} from './plans.schemas.js';

type Owner = { id: string; weekStartsOn: number };

/** Drops `undefined` keys, keeps explicit `null` (which clears a target). */
function patch<T extends object>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as T;
}

async function getOwner(userId: string): Promise<Owner> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, weekStartsOn: true },
  });
  return user;
}

// ---------------------------------------------------------------------------
// Ownership guards. Every mutation resolves back to `userId` before writing.
// ---------------------------------------------------------------------------

async function assertPlan(userId: string, planId: string) {
  const plan = await prisma.workoutPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true, cycleLength: true, startsOn: true },
  });
  if (!plan) throw notFound('plan');
  return plan;
}

async function assertDay(userId: string, dayId: string) {
  const day = await prisma.planDay.findFirst({
    where: { id: dayId, plan: { userId } },
    select: { id: true, planId: true, position: true, plan: { select: { cycleLength: true } } },
  });
  if (!day) throw notFound('workout day');
  return day;
}

async function assertPlanExercise(userId: string, planExerciseId: string) {
  const row = await prisma.planExercise.findFirst({
    where: { id: planExerciseId, planDay: { plan: { userId } } },
    select: { id: true, planDayId: true, sortOrder: true, exerciseId: true },
  });
  if (!row) throw notFound('exercise in this plan');
  return row;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function listPlans(userId: string) {
  const plans = await prisma.workoutPlan.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      description: true,
      cycleLength: true,
      startsOn: true,
      isActive: true,
      updatedAt: true,
      days: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          label: true,
          dayType: true,
          muscleGroups: {
            orderBy: { sortOrder: 'asc' },
            select: { muscleGroup: { select: { id: true, name: true, slug: true, colorHex: true } } },
          },
          _count: { select: { exercises: true } },
        },
      },
    },
  });

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    cycleLength: plan.cycleLength,
    startsOn: plan.startsOn?.toISOString().slice(0, 10) ?? null,
    isActive: plan.isActive,
    updatedAt: plan.updatedAt.toISOString(),
    workoutDayCount: plan.days.filter((d) => d.dayType === PlanDayType.WORKOUT).length,
    exerciseCount: plan.days.reduce((sum, d) => sum + d._count.exercises, 0),
    days: plan.days.map((d) => ({
      id: d.id,
      position: d.position,
      dayType: d.dayType,
      label: d.label,
      muscleGroups: d.muscleGroups.map((m) => m.muscleGroup),
      exerciseCount: d._count.exercises,
    })),
  }));
}

export async function getPlan(userId: string, planId: string) {
  const owner = await getOwner(userId);
  const plan = await prisma.workoutPlan.findFirst({ where: { id: planId, userId }, select: planSelect });
  if (!plan) throw notFound('plan');
  return serializePlan(plan as never, owner.weekStartsOn);
}

export async function getActivePlan(userId: string) {
  const owner = await getOwner(userId);
  const plan = await prisma.workoutPlan.findFirst({
    where: { userId, isActive: true, archivedAt: null },
    select: planSelect,
  });
  return plan ? serializePlan(plan as never, owner.weekStartsOn) : null;
}

export async function createPlan(userId: string, input: z.infer<typeof createPlanSchema>) {
  const owner = await getOwner(userId);

  const duplicate = await prisma.workoutPlan.findFirst({
    where: { userId, name: input.name },
    select: { id: true },
  });
  if (duplicate) throw conflict('You already have a plan with that name.', 'DUPLICATE', { name: 'Name already used.' });

  const days = input.templateSlug ? await resolveTemplate(input.templateSlug, input.cycleLength) : [];

  const plan = await prisma.$transaction(async (tx) => {
    if (input.activate) {
      await tx.workoutPlan.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
    }
    return tx.workoutPlan.create({
      data: {
        userId,
        name: input.name,
        description: input.description ?? null,
        cycleLength: input.cycleLength,
        startsOn: input.startsOn ? parseIsoDate(input.startsOn) : null,
        isActive: input.activate,
        days: days.length
          ? {
              create: days.map((day) => ({
                position: day.position,
                label: day.label,
                dayType: day.dayType,
                muscleGroups: {
                  create: day.muscleGroupIds.map((id, index) => ({ muscleGroupId: id, sortOrder: index })),
                },
                exercises: {
                  create: day.exercises.map((e, index) => ({
                    exerciseId: e.exerciseId,
                    muscleGroupId: e.muscleGroupId,
                    sortOrder: index,
                    targetSets: e.targetSets,
                    targetRepsMin: e.targetRepsMin,
                    targetRepsMax: e.targetRepsMax,
                  })),
                },
              })),
            }
          : undefined,
      },
      select: planSelect,
    });
  });

  return serializePlan(plan as never, owner.weekStartsOn);
}

export async function updatePlan(userId: string, planId: string, input: z.infer<typeof updatePlanSchema>) {
  await assertPlan(userId, planId);
  const owner = await getOwner(userId);
  const { startsOn, ...rest } = input;

  const plan = await prisma.workoutPlan.update({
    where: { id: planId },
    data: {
      ...patch(rest),
      ...(startsOn === undefined ? {} : { startsOn: startsOn ? parseIsoDate(startsOn) : null }),
    },
    select: planSelect,
  });
  return serializePlan(plan as never, owner.weekStartsOn);
}

/** Exactly one plan is active at a time; it drives "today's workout". */
export async function activatePlan(userId: string, planId: string) {
  await assertPlan(userId, planId);
  await prisma.$transaction([
    prisma.workoutPlan.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }),
    prisma.workoutPlan.update({ where: { id: planId }, data: { isActive: true, archivedAt: null } }),
  ]);
  return getPlan(userId, planId);
}

/**
 * Deleting a plan must never touch recorded history: WorkoutSession.planId is
 * `onDelete: SetNull`, so completed sessions survive with their snapshots.
 */
export async function deletePlan(userId: string, planId: string) {
  await assertPlan(userId, planId);
  await prisma.workoutPlan.delete({ where: { id: planId } });
}

export async function duplicatePlan(userId: string, planId: string) {
  const owner = await getOwner(userId);
  const source = await prisma.workoutPlan.findFirst({
    where: { id: planId, userId },
    select: planSelect,
  });
  if (!source) throw notFound('plan');

  let name = `${source.name} (copy)`;
  for (let i = 2; await prisma.workoutPlan.findFirst({ where: { userId, name }, select: { id: true } }); i += 1) {
    name = `${source.name} (copy ${i})`;
  }

  const plan = await prisma.workoutPlan.create({
    data: {
      userId,
      name,
      description: source.description,
      cycleLength: source.cycleLength,
      startsOn: source.startsOn,
      isActive: false,
      days: {
        create: source.days.map((day) => ({
          position: day.position,
          label: day.label,
          dayType: day.dayType,
          notes: day.notes,
          estimatedMinutes: day.estimatedMinutes,
          muscleGroups: {
            create: day.muscleGroups.map((m) => ({ muscleGroupId: m.muscleGroup.id, sortOrder: m.sortOrder })),
          },
          exercises: { create: day.exercises.map(copyPlanExercise) },
        })),
      },
    },
    select: planSelect,
  });

  return serializePlan(plan as never, owner.weekStartsOn);
}

type SourcePlanExercise = Awaited<ReturnType<typeof getSourceDay>>['exercises'][number];

function copyPlanExercise(e: SourcePlanExercise) {
  return {
    exerciseId: e.exercise.id,
    muscleGroupId: e.muscleGroupId,
    sortOrder: e.sortOrder,
    targetSets: e.targetSets,
    targetRepsMin: e.targetRepsMin,
    targetRepsMax: e.targetRepsMax,
    targetWeightKg: e.targetWeightKg,
    targetTimeSeconds: e.targetTimeSeconds,
    targetDistanceM: e.targetDistanceM,
    targetRpe: e.targetRpe,
    restSeconds: e.restSeconds,
    trackingType: e.trackingType,
    notes: e.notes,
    supersetKey: e.supersetKey,
    plannedSets: e.plannedSets.length
      ? {
          create: e.plannedSets.map((s) => ({
            setNumber: s.setNumber,
            setType: s.setType,
            targetReps: s.targetReps,
            targetRepsMax: s.targetRepsMax,
            targetWeightKg: s.targetWeightKg,
            targetTimeSeconds: s.targetTimeSeconds,
            targetDistanceM: s.targetDistanceM,
            targetRpe: s.targetRpe,
            restSeconds: s.restSeconds,
            notes: s.notes,
          })),
        }
      : undefined,
  };
}

function getSourceDay(dayId: string) {
  return prisma.planDay.findFirstOrThrow({ where: { id: dayId }, select: planDaySelect });
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

/** First free position in the cycle, or `null` when the cycle is full. */
async function nextFreePosition(planId: string, cycleLength: number): Promise<number | null> {
  const taken = new Set(
    (await prisma.planDay.findMany({ where: { planId }, select: { position: true } })).map((d) => d.position),
  );
  for (let i = 0; i < cycleLength; i += 1) if (!taken.has(i)) return i;
  return null;
}

export async function createDay(userId: string, planId: string, input: z.infer<typeof createDaySchema>) {
  const plan = await assertPlan(userId, planId);
  const owner = await getOwner(userId);

  const position = input.position ?? (await nextFreePosition(planId, plan.cycleLength));
  if (position === null) {
    throw conflict(
      `Every day in this ${plan.cycleLength}-day cycle is already used. Remove a day or lengthen the cycle.`,
      'CYCLE_FULL',
    );
  }
  if (position >= plan.cycleLength) {
    throw badRequest(`This plan has a ${plan.cycleLength}-day cycle, so the position must be 0-${plan.cycleLength - 1}.`);
  }

  const clash = await prisma.planDay.findUnique({
    where: { planId_position: { planId, position } },
    select: { id: true },
  });
  if (clash) throw conflict('That day of the cycle is already in use.', 'POSITION_TAKEN');

  const day = await prisma.planDay.create({
    data: {
      planId,
      position,
      label: input.label ?? null,
      dayType: input.dayType,
      notes: input.notes ?? null,
      muscleGroups: {
        create: input.muscleGroupIds.map((id, index) => ({ muscleGroupId: id, sortOrder: index })),
      },
    },
    select: planDaySelect,
  });

  return serializePlanDay(day as never, plan.cycleLength, owner.weekStartsOn);
}

export async function updateDay(userId: string, dayId: string, input: z.infer<typeof updateDaySchema>) {
  const existing = await assertDay(userId, dayId);
  const owner = await getOwner(userId);

  if (input.position !== undefined && input.position !== existing.position) {
    if (input.position >= existing.plan.cycleLength) {
      throw badRequest(`Position must be between 0 and ${existing.plan.cycleLength - 1}.`);
    }
    // Moving onto an occupied position swaps the two days rather than failing.
    const occupant = await prisma.planDay.findUnique({
      where: { planId_position: { planId: existing.planId, position: input.position } },
      select: { id: true },
    });
    if (occupant && occupant.id !== dayId) {
      await prisma.$transaction([
        prisma.planDay.update({ where: { id: occupant.id }, data: { position: -1 } }),
        prisma.planDay.update({ where: { id: dayId }, data: { position: input.position } }),
        prisma.planDay.update({ where: { id: occupant.id }, data: { position: existing.position } }),
      ]);
    }
  }

  const { position, ...rest } = input;
  const day = await prisma.planDay.update({
    where: { id: dayId },
    data: { ...patch(rest), ...(position !== undefined ? { position } : {}) },
    select: planDaySelect,
  });

  return serializePlanDay(day as never, existing.plan.cycleLength, owner.weekStartsOn);
}

export async function deleteDay(userId: string, dayId: string) {
  await assertDay(userId, dayId);
  await prisma.planDay.delete({ where: { id: dayId } });
}

export async function duplicateDay(
  userId: string,
  dayId: string,
  input: { position?: number | undefined; label?: string | null | undefined },
) {
  const existing = await assertDay(userId, dayId);
  const owner = await getOwner(userId);
  const source = await getSourceDay(dayId);

  let cycleLength = existing.plan.cycleLength;
  let position = input.position ?? (await nextFreePosition(existing.planId, cycleLength));
  if (position === null) {
    // Cycle is full - "duplicate this day" implies appending it, so the
    // cycle grows by one instead of erroring. Explicit positions still 409.
    if (input.position !== undefined || cycleLength >= 28) {
      throw conflict('Every day in this cycle is already used. Lengthen the cycle first.', 'CYCLE_FULL');
    }
    position = cycleLength;
    cycleLength += 1;
    await prisma.workoutPlan.update({
      where: { id: existing.planId },
      data: { cycleLength },
    });
  }

  const occupied = await prisma.planDay.findUnique({
    where: { planId_position: { planId: existing.planId, position } },
    select: { id: true },
  });
  if (occupied) throw conflict('That day of the cycle is already in use.', 'POSITION_TAKEN');

  const day = await prisma.planDay.create({
    data: {
      planId: existing.planId,
      position,
      label: input.label ?? source.label,
      dayType: source.dayType,
      notes: source.notes,
      estimatedMinutes: source.estimatedMinutes,
      muscleGroups: {
        create: source.muscleGroups.map((m) => ({ muscleGroupId: m.muscleGroup.id, sortOrder: m.sortOrder })),
      },
      exercises: { create: source.exercises.map(copyPlanExercise) },
    },
    select: planDaySelect,
  });

  return serializePlanDay(day as never, cycleLength, owner.weekStartsOn);
}

/**
 * Replaces a day's muscle groups wholesale. Zero is valid (a fully custom
 * day) and so is twenty - nothing here assumes two.
 */
export async function setDayMuscleGroups(userId: string, dayId: string, muscleGroupIds: string[]) {
  const existing = await assertDay(userId, dayId);
  const owner = await getOwner(userId);
  const unique = [...new Set(muscleGroupIds)];

  if (unique.length) {
    const found = await prisma.muscleGroup.count({ where: { id: { in: unique } } });
    if (found !== unique.length) throw badRequest('One of those muscle groups no longer exists.');
  }

  const day = await prisma.$transaction(async (tx) => {
    await tx.planDayMuscleGroup.deleteMany({ where: { planDayId: dayId } });
    if (unique.length) {
      await tx.planDayMuscleGroup.createMany({
        data: unique.map((muscleGroupId, index) => ({ planDayId: dayId, muscleGroupId, sortOrder: index })),
      });
    }
    // Exercises grouped under a removed muscle group become ungrouped rather
    // than disappearing - the user's exercise choices are never silently lost.
    await tx.planExercise.updateMany({
      where: { planDayId: dayId, muscleGroupId: { notIn: unique.length ? unique : ['__none__'] } },
      data: { muscleGroupId: null },
    });
    return tx.planDay.findUniqueOrThrow({ where: { id: dayId }, select: planDaySelect });
  });

  return serializePlanDay(day as never, existing.plan.cycleLength, owner.weekStartsOn);
}

// ---------------------------------------------------------------------------
// Exercises within a day
// ---------------------------------------------------------------------------

async function assertExerciseVisible(userId: string, exerciseId: string) {
  const exercise = await prisma.exercise.findFirst({
    where: {
      id: exerciseId,
      OR: [
        { isCustom: false, status: PublishStatus.PUBLISHED },
        { isCustom: true, createdById: userId },
      ],
    },
    select: { id: true, defaultRestSeconds: true },
  });
  if (!exercise) throw notFound('exercise');
  return exercise;
}

async function nextSortOrder(planDayId: string) {
  const last = await prisma.planExercise.findFirst({
    where: { planDayId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

export async function addPlanExercise(userId: string, dayId: string, input: z.infer<typeof addPlanExerciseSchema>) {
  await assertDay(userId, dayId);
  await assertExerciseVisible(userId, input.exerciseId);

  const { exerciseId, sortOrder, ...targets } = input;
  const created = await prisma.planExercise.create({
    data: {
      planDayId: dayId,
      exerciseId,
      sortOrder: sortOrder ?? (await nextSortOrder(dayId)),
      ...patch(targets),
    },
    select: planExerciseSelect,
  });

  // Popularity drives the default "relevance" ordering in the library.
  await prisma.exercise.update({ where: { id: exerciseId }, data: { popularity: { increment: 1 } } });

  return serializePlanExercise(created as never);
}

/** Bulk add from the picker, preserving the order they were selected in. */
export async function addPlanExercises(userId: string, dayId: string, input: z.infer<typeof addPlanExercisesSchema>) {
  await assertDay(userId, dayId);
  const ids = [...new Set(input.exercises.map((e) => e.exerciseId))];
  const visible = await prisma.exercise.findMany({
    where: {
      id: { in: ids },
      OR: [
        { isCustom: false, status: PublishStatus.PUBLISHED },
        { isCustom: true, createdById: userId },
      ],
    },
    select: { id: true },
  });
  if (visible.length !== ids.length) throw badRequest('One of those exercises is no longer available.');

  let order = await nextSortOrder(dayId);
  await prisma.$transaction([
    prisma.planExercise.createMany({
      data: input.exercises.map((e) => ({
        planDayId: dayId,
        exerciseId: e.exerciseId,
        muscleGroupId: e.muscleGroupId ?? null,
        sortOrder: order++,
        targetSets: e.targetSets ?? null,
        targetRepsMin: e.targetRepsMin ?? null,
        targetRepsMax: e.targetRepsMax ?? null,
      })),
    }),
    prisma.exercise.updateMany({ where: { id: { in: ids } }, data: { popularity: { increment: 1 } } }),
  ]);

  const rows = await prisma.planExercise.findMany({
    where: { planDayId: dayId },
    orderBy: { sortOrder: 'asc' },
    select: planExerciseSelect,
  });
  return rows.map((r) => serializePlanExercise(r as never));
}

export async function updatePlanExercise(
  userId: string,
  planExerciseId: string,
  input: z.infer<typeof updatePlanExerciseSchema>,
) {
  await assertPlanExercise(userId, planExerciseId);
  const updated = await prisma.planExercise.update({
    where: { id: planExerciseId },
    data: patch(input),
    select: planExerciseSelect,
  });
  return serializePlanExercise(updated as never);
}

export async function removePlanExercise(userId: string, planExerciseId: string) {
  await assertPlanExercise(userId, planExerciseId);
  // Past sessions keep their snapshot (planExerciseId is SetNull on delete).
  await prisma.planExercise.delete({ where: { id: planExerciseId } });
}

/** Inserts a copy directly after the original, shifting the rest down. */
export async function duplicatePlanExercise(userId: string, planExerciseId: string) {
  const { planDayId } = await assertPlanExercise(userId, planExerciseId);
  const source = await prisma.planExercise.findUniqueOrThrow({
    where: { id: planExerciseId },
    select: planExerciseSelect,
  });

  const created = await prisma.$transaction(async (tx) => {
    await tx.planExercise.updateMany({
      where: { planDayId, sortOrder: { gt: source.sortOrder } },
      data: { sortOrder: { increment: 1 } },
    });
    return tx.planExercise.create({
      data: {
        ...copyPlanExercise(source as never),
        planDayId,
        sortOrder: source.sortOrder + 1,
      },
      select: planExerciseSelect,
    });
  });

  return serializePlanExercise(created as never);
}

/** Drag-and-drop reordering. Positions are rewritten as a dense 0..n-1 list. */
export async function reorderPlanExercises(userId: string, dayId: string, orderedIds: string[]) {
  await assertDay(userId, dayId);
  const rows = await prisma.planExercise.findMany({ where: { planDayId: dayId }, select: { id: true } });
  const known = new Set(rows.map((r) => r.id));

  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw badRequest('The reorder request did not match this day\u2019s exercises. Reload and try again.');
  }

  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.planExercise.update({ where: { id }, data: { sortOrder: index } })),
  );

  const updated = await prisma.planExercise.findMany({
    where: { planDayId: dayId },
    orderBy: { sortOrder: 'asc' },
    select: planExerciseSelect,
  });
  return updated.map((r) => serializePlanExercise(r as never));
}

/** Replaces the per-set plan. An empty array reverts to uniform `targetSets`. */
export async function setPlannedSets(
  userId: string,
  planExerciseId: string,
  input: z.infer<typeof setPlannedSetsSchema>,
) {
  await assertPlanExercise(userId, planExerciseId);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.planSet.deleteMany({ where: { planExerciseId } });
    if (input.sets.length) {
      await tx.planSet.createMany({
        data: input.sets.map((s, index) => ({
          planExerciseId,
          setNumber: index + 1,
          setType: s.setType,
          targetReps: s.targetReps ?? null,
          targetRepsMax: s.targetRepsMax ?? null,
          targetWeightKg: s.targetWeightKg ?? null,
          targetTimeSeconds: s.targetTimeSeconds ?? null,
          targetDistanceM: s.targetDistanceM ?? null,
          targetRpe: s.targetRpe ?? null,
          restSeconds: s.restSeconds ?? null,
          notes: s.notes ?? null,
        })),
      });
      // Keep the summary target in sync with the detailed plan.
      await tx.planExercise.update({
        where: { id: planExerciseId },
        data: { targetSets: input.sets.length },
      });
    }
    return tx.planExercise.findUniqueOrThrow({ where: { id: planExerciseId }, select: planExerciseSelect });
  });

  return serializePlanExercise(updated as never);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

type TemplateDay = {
  position: number;
  label: string | null;
  dayType: PlanDayType;
  muscleGroupIds: string[];
  exercises: Array<{
    exerciseId: string;
    muscleGroupId: string | null;
    targetSets: number | null;
    targetRepsMin: number | null;
    targetRepsMax: number | null;
  }>;
};

type TemplateStructure = Array<{
  position: number;
  label?: string;
  rest?: boolean;
  muscleGroups?: string[];
  exercises?: Array<{
    slug: string;
    muscleGroup?: string;
    sets?: number;
    repsMin?: number;
    repsMax?: number;
  }>;
}>;

/**
 * Templates reference exercises and muscle groups by slug so they keep working
 * as the library grows. Anything unresolvable is skipped rather than failing
 * the whole plan creation.
 */
async function resolveTemplate(slug: string, cycleLength: number): Promise<TemplateDay[]> {
  const template = await prisma.planTemplate.findUnique({ where: { slug } });
  if (!template) throw notFound('template');

  const structure = template.structure as TemplateStructure;
  const exerciseSlugs = [...new Set(structure.flatMap((d) => d.exercises?.map((e) => e.slug) ?? []))];
  const groupSlugs = [
    ...new Set([
      ...structure.flatMap((d) => d.muscleGroups ?? []),
      ...structure.flatMap((d) => d.exercises?.map((e) => e.muscleGroup).filter(Boolean) ?? []),
    ]),
  ] as string[];

  const [exercises, groups] = await Promise.all([
    prisma.exercise.findMany({ where: { slug: { in: exerciseSlugs } }, select: { id: true, slug: true } }),
    prisma.muscleGroup.findMany({ where: { slug: { in: groupSlugs } }, select: { id: true, slug: true } }),
  ]);
  const exerciseBySlug = new Map(exercises.map((e) => [e.slug, e.id]));
  const groupBySlug = new Map(groups.map((g) => [g.slug, g.id]));

  return structure
    .filter((day) => day.position < cycleLength)
    .map((day) => ({
      position: day.position,
      label: day.label ?? null,
      dayType: day.rest ? PlanDayType.REST : PlanDayType.WORKOUT,
      muscleGroupIds: (day.muscleGroups ?? []).map((s) => groupBySlug.get(s)).filter((v): v is string => Boolean(v)),
      exercises: (day.exercises ?? [])
        .map((e) => {
          const exerciseId = exerciseBySlug.get(e.slug);
          if (!exerciseId) return null;
          return {
            exerciseId,
            muscleGroupId: e.muscleGroup ? groupBySlug.get(e.muscleGroup) ?? null : null,
            targetSets: e.sets ?? null,
            targetRepsMin: e.repsMin ?? null,
            targetRepsMax: e.repsMax ?? null,
          };
        })
        .filter((v): v is TemplateDay['exercises'][number] => v !== null),
    }));
}

export async function listTemplates() {
  const templates = await prisma.planTemplate.findMany({
    where: { status: PublishStatus.PUBLISHED },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      description: true,
      goal: true,
      difficulty: true,
      daysPerWeek: true,
      cycleLength: true,
    },
  });
  return templates;
}
