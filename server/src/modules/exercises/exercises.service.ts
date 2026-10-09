import type { z } from 'zod';
import { Prisma, prisma } from '../../db/prisma.js';
import { notFound } from '../../lib/errors.js';
import { buildSearchText, uniqueSlug } from '../../lib/slug.js';
import { PublishStatus } from '../../generated/prisma/enums.js';
import { exerciseCardSelect, exerciseDetailSelect, serializeExercise } from './exercises.serializer.js';
import type {
  ListExercisesQuery,
  createCustomExerciseSchema,
  updateCustomExerciseSchema,
} from './exercises.schemas.js';

/**
 * Users see published library exercises plus their own custom ones. Another
 * user's custom exercise is never visible.
 */
function visibilityFilter(userId: string): Prisma.ExerciseWhereInput {
  return {
    OR: [
      { isCustom: false, status: PublishStatus.PUBLISHED },
      { isCustom: true, createdById: userId },
    ],
  };
}

/**
 * Forgiving token search: "press bench" and "bench press" both match, and a
 * partial token like "bench" matches every bench variation. Each token must
 * appear somewhere in the normalised haystack (name + aliases + muscle +
 * equipment), which keeps multi-word queries precise.
 */
function searchFilter(q: string): Prisma.ExerciseWhereInput[] {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  return tokens.map((token) => ({
    OR: [
      { searchText: { contains: token } },
      { name: { contains: token, mode: 'insensitive' } },
      { aliases: { has: token } },
    ],
  }));
}

export async function listExercises(userId: string, query: ListExercisesQuery) {
  const and: Prisma.ExerciseWhereInput[] = [visibilityFilter(userId)];

  if (query.q) and.push(...searchFilter(query.q));
  if (query.source === 'mine') and.push({ isCustom: true });
  if (query.source === 'library') and.push({ isCustom: false });

  if (query.muscle) {
    and.push(
      query.includeSecondary
        ? {
            OR: [
              { primaryMuscle: { slug: { in: query.muscle } } },
              { secondaryMuscles: { some: { muscleGroup: { slug: { in: query.muscle } } } } },
            ],
          }
        : { primaryMuscle: { slug: { in: query.muscle } } },
    );
  }
  if (query.equipment) and.push({ equipment: { slug: { in: query.equipment } } });
  if (query.category) and.push({ category: { slug: { in: query.category } } });
  if (query.difficulty) and.push({ difficulty: { in: query.difficulty as never } });
  if (query.movementType) and.push({ movementType: { in: query.movementType as never } });
  if (query.mechanic) and.push({ mechanic: { in: query.mechanic as never } });

  const where: Prisma.ExerciseWhereInput = { AND: and };

  const orderBy: Prisma.ExerciseOrderByWithRelationInput[] =
    query.sort === 'name'
      ? [{ name: 'asc' }]
      : query.sort === 'newest'
        ? [{ createdAt: 'desc' }]
        : query.sort === 'popularity'
          ? [{ popularity: 'desc' }, { name: 'asc' }]
          // "relevance" without full-text ranking: most-used first, then A-Z.
          : [{ popularity: 'desc' }, { name: 'asc' }];

  const [total, rows] = await Promise.all([
    prisma.exercise.count({ where }),
    prisma.exercise.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: exerciseCardSelect,
    }),
  ]);

  return {
    exercises: rows.map(serializeExercise),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getExercise(userId: string, idOrSlug: string) {
  const exercise = await prisma.exercise.findFirst({
    where: { AND: [visibilityFilter(userId), { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }] },
    select: exerciseDetailSelect,
  });
  if (!exercise) throw notFound('exercise');

  const note = await prisma.userExerciseNote.findUnique({
    where: { userId_exerciseId: { userId, exerciseId: exercise.id } },
    select: { body: true, updatedAt: true },
  });

  return { exercise: serializeExercise(exercise), note };
}

export type CreateExerciseInput = z.infer<typeof createCustomExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateCustomExerciseSchema>;

/** Drops `undefined` keys while preserving explicit `null` (which clears a field). */
function patch<T extends object>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Explicit field mapping rather than spreading request data straight into
 * Prisma - the API shape and the database shape are allowed to diverge, and
 * mass assignment is how `status` or `isCustom` get forged.
 */
function toExerciseColumns(input: UpdateExerciseInput) {
  return patch({
    name: input.name,
    description: input.description,
    primaryMuscleId: input.primaryMuscleId,
    equipmentId: input.equipmentId,
    categoryId: input.categoryId,
    difficulty: input.difficulty,
    mechanic: input.mechanic,
    movementType: input.movementType,
    trackingType: input.trackingType,
    isUnilateral: input.isUnilateral,
    defaultRestSeconds: input.defaultRestSeconds,
    instructions: input.instructions,
    commonMistakes: input.commonMistakes,
    tips: input.tips,
    breathing: input.breathing,
    aliases: input.aliases?.map((a) => a.toLowerCase()),
    thumbnailUrl: input.thumbnailUrl,
    mediaUrl: input.mediaUrl,
    mediaType: input.mediaType,
  });
}

/**
 * The searchable blob is rebuilt from related rows on every write so search
 * stays correct without a background job.
 */
async function computeSearchText(input: {
  name: string;
  aliases?: string[] | undefined;
  primaryMuscleId?: string | undefined;
  equipmentId?: string | null | undefined;
}) {
  const [muscle, equipment] = await Promise.all([
    input.primaryMuscleId
      ? prisma.muscleGroup.findUnique({ where: { id: input.primaryMuscleId }, select: { name: true } })
      : null,
    input.equipmentId
      ? prisma.equipment.findUnique({ where: { id: input.equipmentId }, select: { name: true } })
      : null,
  ]);
  return buildSearchText([input.name, ...(input.aliases ?? []), muscle?.name, equipment?.name]);
}

export async function createCustomExercise(userId: string, input: CreateExerciseInput) {
  const { secondaryMuscleIds } = input;
  const slug = await uniqueSlug(`${input.name}-custom`, async (candidate) =>
    Boolean(await prisma.exercise.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );

  const exercise = await prisma.exercise.create({
    data: {
      ...toExerciseColumns(input),
      name: input.name,
      primaryMuscleId: input.primaryMuscleId,
      slug,
      isCustom: true,
      createdById: userId,
      status: PublishStatus.PUBLISHED,
      searchText: await computeSearchText(input),
      ...(secondaryMuscleIds?.length
        ? { secondaryMuscles: { create: secondaryMuscleIds.map((id) => ({ muscleGroupId: id })) } }
        : {}),
    },
    select: exerciseDetailSelect,
  });

  return serializeExercise(exercise);
}

/** Only the author of a custom exercise may edit or delete it. */
async function assertOwnedCustom(userId: string, id: string) {
  const existing = await prisma.exercise.findFirst({
    where: { id, isCustom: true, createdById: userId },
    select: { id: true, name: true, aliases: true, primaryMuscleId: true, equipmentId: true },
  });
  if (!existing) throw notFound('custom exercise');
  return existing;
}

export async function updateCustomExercise(userId: string, id: string, input: UpdateExerciseInput) {
  const existing = await assertOwnedCustom(userId, id);
  const { secondaryMuscleIds } = input;

  const exercise = await prisma.exercise.update({
    where: { id },
    data: {
      ...toExerciseColumns(input),
      searchText: await computeSearchText({
        name: input.name ?? existing.name,
        aliases: input.aliases ?? existing.aliases,
        primaryMuscleId: input.primaryMuscleId ?? existing.primaryMuscleId,
        equipmentId: input.equipmentId === undefined ? existing.equipmentId : input.equipmentId,
      }),
      ...(secondaryMuscleIds
        ? {
            secondaryMuscles: {
              deleteMany: {},
              create: secondaryMuscleIds.map((mid) => ({ muscleGroupId: mid })),
            },
          }
        : {}),
    },
    select: exerciseDetailSelect,
  });

  return serializeExercise(exercise);
}

export async function deleteCustomExercise(userId: string, id: string) {
  await assertOwnedCustom(userId, id);

  // Referenced by history? Archive instead of destroying the audit trail.
  const used = await prisma.sessionExercise.count({ where: { exerciseId: id } });
  if (used > 0) {
    await prisma.exercise.update({ where: { id }, data: { status: PublishStatus.ARCHIVED } });
    return { archived: true };
  }

  await prisma.planExercise.deleteMany({ where: { exerciseId: id } });
  await prisma.exercise.delete({ where: { id } });
  return { archived: false };
}

export async function upsertNote(userId: string, exerciseId: string, body: string) {
  if (!body.trim()) {
    await prisma.userExerciseNote.deleteMany({ where: { userId, exerciseId } });
    return null;
  }
  return prisma.userExerciseNote.upsert({
    where: { userId_exerciseId: { userId, exerciseId } },
    create: { userId, exerciseId, body },
    update: { body },
    select: { body: true, updatedAt: true },
  });
}
