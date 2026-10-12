import { randomUUID } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { requireAdmin, currentUser } from '../../middleware/auth.js';
import { cuidParam, validate } from '../../middleware/validate.js';
import { buildSearchText, uniqueSlug } from '../../lib/slug.js';
import { MediaType, PublishStatus } from '../../generated/prisma/enums.js';
import { Prisma } from '../../db/prisma.js';
import {
  adminExerciseSchema,
  adminExerciseUpdateSchema,
  listExercisesQuery,
} from '../exercises/exercises.schemas.js';
import { exerciseDetailSelect, serializeExercise } from '../exercises/exercises.serializer.js';

const adminListQuery = listExercisesQuery.extend({ status: z.string().optional() });

const router = Router();
router.use(requireAdmin);

/* ------------------------------------------------------------------ */
/* Media uploads - images and short looping clips                       */
/* ------------------------------------------------------------------ */

const ALLOWED_MIME: Record<string, { ext: string; type: MediaType }> = {
  'image/jpeg': { ext: '.jpg', type: MediaType.IMAGE },
  'image/png': { ext: '.png', type: MediaType.IMAGE },
  'image/webp': { ext: '.webp', type: MediaType.IMAGE },
  'image/gif': { ext: '.gif', type: MediaType.GIF },
  'video/mp4': { ext: '.mp4', type: MediaType.VIDEO },
  'video/webm': { ext: '.webm', type: MediaType.VIDEO },
};

// Serverless filesystems (Vercel) are read-only outside /tmp. Files there are
// still per-instance and ephemeral - real production uploads need object
// storage - but this keeps the endpoint functional instead of crashing.
const UPLOAD_DEST = process.env.VERCEL ? '/tmp/forge-uploads' : env.UPLOAD_DIR;
fs.mkdirSync(UPLOAD_DEST, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DEST,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_MIME[file.mimetype]?.ext ?? '.bin'}`),
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) cb(null, true);
    else cb(badRequest('Only JPG, PNG, WebP, GIF, MP4 and WebM files are accepted.'));
  },
});

/**
 * The client-reported MIME type is not trustworthy, so every upload is checked
 * against its magic bytes. A mismatch means a renamed `.exe`/script - delete it.
 */
const SIGNATURES: { mime: string; test: (head: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', test: (h) => h.length >= 3 && h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff },
  {
    mime: 'image/png',
    test: (h) => h.length >= 8 && h.readBigUInt64BE(0) === 0x89504e470d0a1a0an,
  },
  { mime: 'image/gif', test: (h) => h.length >= 6 && h.toString('ascii', 0, 4) === 'GIF8' },
  {
    mime: 'image/webp',
    test: (h) => h.length >= 12 && h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP',
  },
  { mime: 'video/mp4', test: (h) => h.length >= 8 && h.toString('ascii', 4, 8) === 'ftyp' },
  { mime: 'video/webm', test: (h) => h.length >= 4 && h.readUInt32BE(0) === 0x1a45dfa3 },
];

async function sniffMime(filePath: string): Promise<string | null> {
  const handle = await fsp.open(filePath, 'r');
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, 12, 0);
    const slice = head.subarray(0, bytesRead);
    return SIGNATURES.find((sig) => sig.test(slice))?.mime ?? null;
  } finally {
    await handle.close();
  }
}

router.post('/media', upload.array('files', 2), async (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!files.length) throw badRequest('Attach at least one file.');

  // Verify content signatures before the files are ever trusted.
  for (const file of files) {
    const actual = await sniffMime(file.path).catch(() => null);
    if (actual !== file.mimetype) {
      await Promise.all(files.map((f) => fsp.unlink(f.path).catch(() => undefined)));
      throw badRequest('The file contents do not match its declared type.');
    }
  }

  const created = await Promise.all(
    files.map((file) =>
      prisma.mediaAsset.create({
        data: {
          url: `/uploads/${file.filename}`,
          type: ALLOWED_MIME[file.mimetype]!.type,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedById: currentUser(req).id,
          attribution: typeof req.body?.attribution === 'string' ? req.body.attribution.slice(0, 300) : null,
          license: typeof req.body?.license === 'string' ? req.body.license.slice(0, 120) : null,
        },
        select: { id: true, url: true, type: true, mimeType: true, sizeBytes: true, createdAt: true },
      }),
    ),
  );
  res.status(201).json({ assets: created });
});

/* ------------------------------------------------------------------ */
/* Exercise management - the library is data, not code                  */
/* ------------------------------------------------------------------ */

/** Admin list sees every status, including drafts and archived exercises. */
router.get('/exercises', validate({ query: adminListQuery }), async (req, res) => {
  const query = req.query as unknown as z.infer<typeof adminListQuery>;
  const status = query.status;

  const and: Prisma.ExerciseWhereInput[] = [{ isCustom: false }];
  if (status && status in PublishStatus) and.push({ status: status as PublishStatus });
  if (query.q) {
    for (const token of query.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)) {
      and.push({ OR: [{ searchText: { contains: token } }, { name: { contains: token, mode: 'insensitive' } }] });
    }
  }
  if (query.muscle) and.push({ primaryMuscle: { slug: { in: query.muscle } } });
  if (query.equipment) and.push({ equipment: { slug: { in: query.equipment } } });
  if (query.category) and.push({ category: { slug: { in: query.category } } });
  if (query.difficulty) and.push({ difficulty: { in: query.difficulty as never } });

  const where: Prisma.ExerciseWhereInput = { AND: and };
  const [total, rows] = await Promise.all([
    prisma.exercise.count({ where }),
    prisma.exercise.findMany({
      where,
      orderBy: [{ status: 'asc' }, { popularity: 'desc' }, { name: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true, slug: true, name: true, status: true, difficulty: true, popularity: true,
        isCustom: true, thumbnailUrl: true, frameUrls: true, mediaType: true, updatedAt: true,
        primaryMuscle: { select: { id: true, slug: true, name: true, colorHex: true } },
        equipment: { select: { id: true, slug: true, name: true } },
        _count: { select: { sessionExercises: true } },
      },
    }),
  ]);

  res.json({
    exercises: rows.map(({ _count, ...e }) => ({
      ...e,
      thumbnailUrl: e.thumbnailUrl ?? e.frameUrls[0] ?? null,
      timesPerformed: _count.sessionExercises,
      updatedAt: e.updatedAt.toISOString(),
    })),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
  });
});

router.post('/exercises', validate({ body: adminExerciseSchema }), async (req, res) => {
  const input = req.body as z.infer<typeof adminExerciseSchema>;
  const slug = input.slug
    ? await uniqueSlug(input.slug, async (c) => Boolean(await prisma.exercise.findUnique({ where: { slug: c }, select: { id: true } })))
    : await uniqueSlug(input.name, async (c) => Boolean(await prisma.exercise.findUnique({ where: { slug: c }, select: { id: true } })));

  const [muscle, equipment, asset] = await Promise.all([
    prisma.muscleGroup.findUnique({ where: { id: input.primaryMuscleId }, select: { name: true } }),
    input.equipmentId ? prisma.equipment.findUnique({ where: { id: input.equipmentId }, select: { name: true } }) : null,
    input.mediaAssetId ? prisma.mediaAsset.findUnique({ where: { id: input.mediaAssetId } }) : null,
  ]);
  if (!muscle) throw badRequest('Primary muscle is required.', { primaryMuscleId: 'Unknown muscle group.' });

  const exercise = await prisma.exercise.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      primaryMuscleId: input.primaryMuscleId,
      equipmentId: input.equipmentId ?? null,
      categoryId: input.categoryId ?? null,
      difficulty: input.difficulty,
      mechanic: input.mechanic,
      movementType: input.movementType,
      trackingType: input.trackingType,
      isUnilateral: input.isUnilateral,
      defaultRestSeconds: input.defaultRestSeconds,
      instructions: input.instructions ?? [],
      commonMistakes: input.commonMistakes ?? [],
      tips: input.tips ?? [],
      breathing: input.breathing ?? null,
      aliases: (input.aliases ?? []).map((a) => a.toLowerCase()),
      thumbnailUrl: input.thumbnailUrl ?? asset?.url ?? null,
      mediaUrl: input.mediaUrl ?? asset?.url ?? null,
      mediaType: input.mediaType,
      mediaAssetId: input.mediaAssetId ?? null,
      mediaAttribution: input.mediaAttribution ?? asset?.attribution ?? null,
      popularity: input.popularity ?? 0,
      status: input.status,
      isCustom: false,
      searchText: buildSearchText([input.name, ...(input.aliases ?? []), muscle.name, equipment?.name]),
      ...(input.secondaryMuscleIds?.length
        ? { secondaryMuscles: { create: input.secondaryMuscleIds.map((id) => ({ muscleGroupId: id })) } }
        : {}),
    },
    select: exerciseDetailSelect,
  });
  res.status(201).json({ exercise: serializeExercise(exercise) });
});

router.patch(
  '/exercises/:id',
  validate({ params: cuidParam('id'), body: adminExerciseUpdateSchema }),
  async (req, res) => {
    const input = req.body as z.infer<typeof adminExerciseUpdateSchema>;
    const existing = await prisma.exercise.findFirst({
      where: { id: req.params.id as string, isCustom: false },
      select: { id: true, name: true, aliases: true, primaryMuscleId: true, equipmentId: true },
    });
    if (!existing) throw notFound('exercise');

    const asset = input.mediaAssetId ? await prisma.mediaAsset.findUnique({ where: { id: input.mediaAssetId } }) : null;
    const [muscle, equipment] = await Promise.all([
      input.primaryMuscleId ? prisma.muscleGroup.findUnique({ where: { id: input.primaryMuscleId }, select: { name: true } }) : null,
      input.equipmentId ? prisma.equipment.findUnique({ where: { id: input.equipmentId }, select: { name: true } }) : null,
    ]);

    const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

    const exercise = await prisma.exercise.update({
      where: { id: existing.id },
      data: defined({
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
        thumbnailUrl: input.thumbnailUrl ?? asset?.url,
        mediaUrl: input.mediaUrl ?? asset?.url,
        mediaType: input.mediaType,
        mediaAssetId: input.mediaAssetId,
        mediaAttribution: input.mediaAttribution ?? asset?.attribution,
        popularity: input.popularity,
        status: input.status,
        frameUrls: input.mediaAssetId && asset ? [asset.url] : undefined,
        searchText: buildSearchText([
          input.name ?? existing.name,
          ...(input.aliases ?? existing.aliases),
          muscle?.name ?? (await prisma.muscleGroup.findUnique({ where: { id: existing.primaryMuscleId }, select: { name: true } }))?.name,
          equipment?.name ?? (existing.equipmentId ? (await prisma.equipment.findUnique({ where: { id: existing.equipmentId }, select: { name: true } }))?.name : undefined),
        ]),
      }),
      select: exerciseDetailSelect,
    });

    if (input.secondaryMuscleIds) {
      await prisma.$transaction([
        prisma.exerciseSecondaryMuscle.deleteMany({ where: { exerciseId: existing.id } }),
        prisma.exerciseSecondaryMuscle.createMany({
          data: input.secondaryMuscleIds.map((id) => ({ exerciseId: existing.id, muscleGroupId: id })),
        }),
      ]);
    }

    res.json({ exercise: serializeExercise(exercise) });
  },
);

/** Archive keeps history intact; delete is only for never-used rows. */
router.delete('/exercises/:id', validate({ params: cuidParam('id') }), async (req, res) => {
  const existing = await prisma.exercise.findFirst({
    where: { id: req.params.id as string, isCustom: false },
    select: { id: true },
  });
  if (!existing) throw notFound('exercise');

  const used = await prisma.sessionExercise.count({ where: { exerciseId: existing.id } });
  if (used > 0) {
    await prisma.exercise.update({ where: { id: existing.id }, data: { status: PublishStatus.ARCHIVED } });
    res.json({ archived: true });
    return;
  }
  await prisma.planExercise.deleteMany({ where: { exerciseId: existing.id } });
  await prisma.exercise.delete({ where: { id: existing.id } });
  res.json({ archived: false });
});

/** Admin overview stats for the panel header. */
router.get('/stats', async (_req, res) => {
  const [users, exercises, sessions, custom] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.exercise.count({ where: { isCustom: false, status: PublishStatus.PUBLISHED } }),
    prisma.workoutSession.count({ where: { status: 'COMPLETED' } }),
    prisma.exercise.count({ where: { isCustom: true } }),
  ]);
  res.json({ users, libraryExercises: exercises, completedSessions: sessions, customExercises: custom });
});

export default router;
