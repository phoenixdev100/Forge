import fs from 'node:fs/promises';
import path from 'node:path';
import { Prisma, prisma } from '../../src/db/prisma.js';
import { buildSearchText, slugify } from '../../src/lib/slug.js';
import {
  Difficulty,
  Mechanic,
  MediaType,
  MovementType,
  PublishStatus,
  TrackingType,
} from '../../src/generated/prisma/enums.js';
import {
  datasetCategoryMap,
  datasetEquipmentMap,
  datasetMuscleMap,
} from './data/taxonomy.js';
import { curated, extraExercises, type Curated } from './data/curated.js';

const DATASET_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const CACHE_DIR = path.join(process.cwd(), 'prisma', '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'free-exercise-db.json');
const ATTRIBUTION = 'free-exercise-db (public domain / Unlicense)';

type DatasetExercise = {
  id: string;
  name: string;
  force: 'push' | 'pull' | 'static' | null;
  level: 'beginner' | 'intermediate' | 'expert';
  mechanic: 'compound' | 'isolation' | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
};

/**
 * Fetches the public-domain dataset, caching it on disk so re-seeding works
 * offline and does not hammer GitHub.
 */
async function loadDataset(): Promise<DatasetExercise[]> {
  try {
    const cached = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(cached) as DatasetExercise[];
  } catch {
    // Not cached yet - fall through to the network.
  }

  try {
    const response = await fetch(DATASET_URL, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as DatasetExercise[];
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(data));
    return data;
  } catch (err) {
    console.warn(
      `  ! Could not download the exercise dataset (${(err as Error).message}).\n` +
        '    Seeding the curated core library only. Re-run the seed when online for the full set.',
    );
    return [];
  }
}

const DIFFICULTY: Record<string, Difficulty> = {
  beginner: Difficulty.BEGINNER,
  intermediate: Difficulty.INTERMEDIATE,
  expert: Difficulty.ADVANCED,
};

/** Infers a movement pattern from the dataset's coarse `force` plus the name. */
function inferMovementType(ex: DatasetExercise): MovementType {
  const name = ex.name.toLowerCase();
  if (ex.category === 'olympic weightlifting') return MovementType.OLYMPIC;
  if (ex.category === 'cardio') return MovementType.CARDIO;
  if (ex.category === 'stretching') return MovementType.MOBILITY;
  if (/\bsquat\b/.test(name)) return MovementType.SQUAT;
  if (/lunge|step[- ]up|split squat/.test(name)) return MovementType.LUNGE;
  if (/deadlift|hip thrust|glute bridge|good morning|swing|romanian/.test(name)) return MovementType.HINGE;
  if (/carry|farmer|yoke|drag/.test(name)) return MovementType.CARRY;
  if (/twist|rotation|woodchop|russian/.test(name)) return MovementType.ROTATION;
  if (ex.force === 'static') return MovementType.ISOMETRIC;
  if (ex.force === 'push') return MovementType.PUSH;
  if (ex.force === 'pull') return MovementType.PULL;
  return MovementType.OTHER;
}

/**
 * Picks the right measurement type so workout mode shows the correct inputs.
 * A plank is time, a pull-up is loadable bodyweight, a sprint is distance.
 */
function inferTrackingType(ex: DatasetExercise): TrackingType {
  const name = ex.name.toLowerCase();
  const bodyweight = ex.equipment === 'body only' || ex.equipment === null;

  if (ex.category === 'stretching') return TrackingType.TIME;
  if (ex.category === 'cardio') {
    return /run|sprint|row|bike|cycling|walk|jog|elliptical|treadmill/.test(name)
      ? TrackingType.DISTANCE_TIME
      : TrackingType.TIME;
  }
  if (/plank|bridge hold|hold|iso|wall sit|hang\b/.test(name) || ex.force === 'static') return TrackingType.TIME;
  // Loadable bodyweight movements: people add a belt or vest to these.
  if (bodyweight && /pull[- ]?up|chin[- ]?up|dip|push[- ]?up|leg raise|muscle[- ]?up|row\b/.test(name)) {
    return TrackingType.WEIGHTED_BODYWEIGHT;
  }
  if (bodyweight) return TrackingType.BODYWEIGHT_REPS;
  return TrackingType.WEIGHT_REPS;
}

/** Compounds and heavy lifts deserve longer defaults than curls. */
function inferRest(ex: DatasetExercise): number {
  if (ex.category === 'stretching') return 30;
  if (ex.category === 'cardio') return 60;
  if (ex.mechanic === 'compound') return /squat|deadlift|bench|press|row|pull/.test(ex.name.toLowerCase()) ? 150 : 120;
  return 75;
}

type Lookups = {
  muscles: Map<string, string>;
  equipment: Map<string, string>;
  categories: Map<string, string>;
};

export async function seedExercises(lookups: Lookups) {
  console.log('  ... fetching exercise dataset');
  const dataset = await loadDataset();
  const curatedById = new Map(curated.filter((c) => c.datasetId).map((c) => [c.datasetId as string, c]));
  const usedSlugs = new Set<string>();

  const resolveMuscle = (slug: string | undefined) => (slug ? lookups.muscles.get(slug) : undefined);

  const rows: Array<{ data: Prisma.ExerciseCreateManyInput; secondary: string[] }> = [];

  // --- 1. The public-domain dataset, enriched by the curated layer ---------
  for (const ex of dataset) {
    const override = curatedById.get(ex.id);

    const primarySlug = override?.primaryMuscle ?? datasetMuscleMap[ex.primaryMuscles[0] ?? ''] ?? 'full-body';
    const primaryMuscleId = resolveMuscle(primarySlug) ?? resolveMuscle('full-body');
    if (!primaryMuscleId) continue;

    const equipmentSlug = override?.equipment ?? datasetEquipmentMap[ex.equipment ?? 'other'] ?? 'other';
    const categorySlug = override?.category ?? datasetCategoryMap[ex.category] ?? 'strength';

    const name = override?.name ?? ex.name;
    let slug = override?.slug ?? slugify(ex.name);
    if (usedSlugs.has(slug)) slug = `${slug}-${slugify(ex.equipment ?? 'variation')}`;
    if (usedSlugs.has(slug)) continue;
    usedSlugs.add(slug);

    // Two key positions of the movement, cross-faded into a silent loop.
    const frameUrls = ex.images.map((img) => `${IMAGE_BASE}/${img}`);

    const secondarySlugs = [
      ...new Set(
        (override?.secondaryMuscles ?? ex.secondaryMuscles.map((m) => datasetMuscleMap[m] ?? '')).filter(Boolean),
      ),
    ].filter((s) => s !== primarySlug);

    const aliases = [...new Set([...(override?.aliases ?? []), ex.name.toLowerCase()])];

    rows.push({
      data: {
        slug,
        name,
        description: override?.description ?? null,
        primaryMuscleId,
        equipmentId: lookups.equipment.get(equipmentSlug) ?? null,
        categoryId: lookups.categories.get(categorySlug) ?? null,
        difficulty: override?.difficulty ?? DIFFICULTY[ex.level] ?? Difficulty.INTERMEDIATE,
        mechanic:
          override?.mechanic ??
          (ex.mechanic === 'compound'
            ? Mechanic.COMPOUND
            : ex.mechanic === 'isolation'
              ? Mechanic.ISOLATION
              : Mechanic.UNKNOWN),
        movementType: override?.movementType ?? inferMovementType(ex),
        trackingType: override?.trackingType ?? inferTrackingType(ex),
        isUnilateral: override?.isUnilateral ?? /one[- ]arm|single[- ]|one[- ]leg|alternat/i.test(ex.name),
        defaultRestSeconds: override?.defaultRestSeconds ?? inferRest(ex),
        instructions: override?.instructions ?? ex.instructions,
        commonMistakes: override?.commonMistakes ?? [],
        tips: override?.tips ?? [],
        breathing: override?.breathing ?? null,
        aliases,
        thumbnailUrl: frameUrls[0] ?? null,
        mediaUrl: frameUrls[1] ?? frameUrls[0] ?? null,
        mediaType: frameUrls.length ? MediaType.IMAGE : MediaType.NONE,
        mediaAttribution: frameUrls.length ? ATTRIBUTION : null,
        frameUrls,
        status: PublishStatus.PUBLISHED,
        isCustom: false,
        popularity: override?.popularity ?? 0,
        searchText: buildSearchText([name, ...aliases, primarySlug, equipmentSlug, ...secondarySlugs]),
      },
      secondary: secondarySlugs,
    });
  }

  // --- 2. Curated movements the dataset is missing -------------------------
  const extras: Curated[] = [
    ...extraExercises,
    // Curated entries whose dataset row did not make it in (e.g. duplicate slug).
    ...curated.filter((c) => c.datasetId && !usedSlugs.has(c.slug) && c.instructions),
  ];

  for (const ex of extras) {
    if (usedSlugs.has(ex.slug)) continue;
    const primaryMuscleId = resolveMuscle(ex.primaryMuscle) ?? resolveMuscle('full-body');
    if (!primaryMuscleId) continue;
    usedSlugs.add(ex.slug);

    const secondarySlugs = (ex.secondaryMuscles ?? []).filter((s) => s !== ex.primaryMuscle);
    const aliases = [...new Set([...(ex.aliases ?? []), ex.name.toLowerCase()])];

    rows.push({
      data: {
        slug: ex.slug,
        name: ex.name,
        description: ex.description ?? null,
        primaryMuscleId,
        equipmentId: lookups.equipment.get(ex.equipment ?? 'other') ?? null,
        categoryId: lookups.categories.get(ex.category ?? 'strength') ?? null,
        difficulty: ex.difficulty ?? Difficulty.INTERMEDIATE,
        mechanic: ex.mechanic ?? Mechanic.UNKNOWN,
        movementType: ex.movementType ?? MovementType.OTHER,
        trackingType: ex.trackingType ?? TrackingType.WEIGHT_REPS,
        isUnilateral: ex.isUnilateral ?? false,
        defaultRestSeconds: ex.defaultRestSeconds ?? 90,
        instructions: ex.instructions ?? [],
        commonMistakes: ex.commonMistakes ?? [],
        tips: ex.tips ?? [],
        breathing: ex.breathing ?? null,
        aliases,
        mediaType: MediaType.NONE,
        frameUrls: [],
        status: PublishStatus.PUBLISHED,
        isCustom: false,
        popularity: ex.popularity ?? 0,
        searchText: buildSearchText([ex.name, ...aliases, ex.primaryMuscle, ex.equipment, ...secondarySlugs]),
      },
      secondary: secondarySlugs,
    });
  }

  // --- 3. Write, idempotently ---------------------------------------------
  // One sequential upsert per exercise means ~2 round trips each; on a remote
  // database that is minutes of silence. Instead: one read for existing
  // slugs, a single bulk insert for new rows, and parallel batches for the
  // updates needed to keep re-seeding fresh.
  console.log(`  ... writing ${rows.length} exercises`);

  const existingRows = await prisma.exercise.findMany({
    where: { slug: { in: rows.map((r) => r.data.slug) } },
    select: { id: true, slug: true },
  });
  const existingBySlug = new Map(existingRows.map((r) => [r.slug, r.id]));

  const toCreate = rows.filter((r) => !existingBySlug.has(r.data.slug));
  const toUpdate = rows.filter((r) => existingBySlug.has(r.data.slug));

  const linksFor = (row: { data: Prisma.ExerciseCreateManyInput; secondary: string[] }) => {
    const exerciseId = existingBySlug.get(row.data.slug);
    if (!exerciseId) return [];
    return row.secondary
      .map((s) => lookups.muscles.get(s))
      .filter((v): v is string => Boolean(v))
      .map((muscleGroupId) => ({ exerciseId, muscleGroupId }));
  };

  if (toCreate.length) {
    // createMany cannot nest the join rows, so exercises go in flat and the
    // secondary-muscle links are bulk-created once their ids are known.
    await prisma.exercise.createMany({ data: toCreate.map((r) => r.data), skipDuplicates: true });
    const created = await prisma.exercise.findMany({
      where: { slug: { in: toCreate.map((r) => r.data.slug) } },
      select: { id: true, slug: true },
    });
    for (const row of created) existingBySlug.set(row.slug, row.id);

    const links = toCreate.flatMap(linksFor);
    if (links.length) await prisma.exerciseSecondaryMuscle.createMany({ data: links, skipDuplicates: true });
  }

  const CONCURRENCY = 12;
  for (let i = 0; i < toUpdate.length; i += CONCURRENCY) {
    await Promise.all(
      toUpdate.slice(i, i + CONCURRENCY).map((r) =>
        prisma.exercise.update({
          where: { id: existingBySlug.get(r.data.slug)! },
          data: {
            ...r.data,
            secondaryMuscles: {
              deleteMany: {},
              create: linksFor(r).map(({ muscleGroupId }) => ({ muscleGroupId })),
            },
          },
        }),
      ),
    );
    const done = Math.min(i + CONCURRENCY, toUpdate.length);
    if (done % 120 < CONCURRENCY || done === toUpdate.length) {
      console.log(`  ... refreshed ${done}/${toUpdate.length} existing exercises`);
    }
  }

  return { created: toCreate.length, updated: toUpdate.length, total: rows.length, fromDataset: dataset.length };
}
