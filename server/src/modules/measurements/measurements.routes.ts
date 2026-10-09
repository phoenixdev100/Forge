import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { currentUser } from '../../middleware/auth.js';
import { cuidParam, isoDate, validate } from '../../middleware/validate.js';
import { notFound } from '../../lib/errors.js';
import { parseIsoDate, toIsoDate } from '../../lib/dates.js';
import { num } from '../../lib/serialize.js';
import { Prisma } from '../../db/prisma.js';

const router = Router();
const uid = currentUser;

/** Every field optional - users track whichever measurements they care about. */
const measurementSchema = z.object({
  measuredOn: isoDate,
  bodyWeightKg: z.coerce.number().min(20).max(400).nullish(),
  bodyFatPct: z.coerce.number().min(1).max(70).nullish(),
  neckCm: z.coerce.number().min(10).max(100).nullish(),
  shouldersCm: z.coerce.number().min(50).max(250).nullish(),
  chestCm: z.coerce.number().min(40).max(250).nullish(),
  waistCm: z.coerce.number().min(30).max(250).nullish(),
  hipsCm: z.coerce.number().min(40).max(250).nullish(),
  leftArmCm: z.coerce.number().min(10).max(100).nullish(),
  rightArmCm: z.coerce.number().min(10).max(100).nullish(),
  leftThighCm: z.coerce.number().min(20).max(150).nullish(),
  rightThighCm: z.coerce.number().min(20).max(150).nullish(),
  leftCalfCm: z.coerce.number().min(10).max(100).nullish(),
  rightCalfCm: z.coerce.number().min(10).max(100).nullish(),
  custom: z.record(z.string().max(40), z.coerce.number()).nullish(),
  notes: z.string().trim().max(600).nullish(),
});

const FIELDS = [
  'bodyWeightKg', 'bodyFatPct', 'neckCm', 'shouldersCm', 'chestCm', 'waistCm', 'hipsCm',
  'leftArmCm', 'rightArmCm', 'leftThighCm', 'rightThighCm', 'leftCalfCm', 'rightCalfCm',
] as const;

function serialize(m: { id: string; measuredOn: Date; notes: string | null; custom: unknown } & Record<string, unknown>) {
  const out: Record<string, unknown> = {
    id: m.id,
    measuredOn: toIsoDate(m.measuredOn),
    notes: m.notes,
    custom: m.custom ?? null,
  };
  for (const f of FIELDS) out[f] = num(m[f] as Parameters<typeof num>[0]);
  return out;
}

/** One entry per day - recording twice on the same date updates, not duplicates. */
router.get('/', async (req, res) => {
  const rows = await prisma.bodyMeasurement.findMany({
    where: { userId: uid(req).id },
    orderBy: { measuredOn: 'desc' },
    take: 365,
  });
  res.json({ measurements: rows.map(serialize) });
});

router.post('/', validate({ body: measurementSchema }), async (req, res) => {
  const userId = uid(req).id;
  const body = req.body as z.infer<typeof measurementSchema>;
  const date = parseIsoDate(body.measuredOn);
  const data = Object.fromEntries(FIELDS.map((f) => [f, body[f] ?? null]));
  const row = await prisma.bodyMeasurement.upsert({
    where: { userId_measuredOn: { userId, measuredOn: date } },
    create: {
      userId,
      measuredOn: date,
      ...data,
      custom: body.custom ?? Prisma.JsonNull,
      notes: body.notes ?? null,
    },
    update: {
      ...data,
      ...(body.custom !== undefined ? { custom: body.custom ?? Prisma.JsonNull } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });
  res.status(201).json({ measurement: serialize(row) });
});

router.patch('/:id', validate({ params: cuidParam('id'), body: measurementSchema.partial() }), async (req, res) => {
  const userId = uid(req).id;
  const existing = await prisma.bodyMeasurement.findFirst({ where: { id: req.params.id as string, userId }, select: { id: true } });
  if (!existing) throw notFound('measurement');
  const body = req.body as Partial<z.infer<typeof measurementSchema>>;
  const data = Object.fromEntries(
    [
      ...FIELDS.map((f) => [f, body[f]] as const),
      ['notes', body.notes] as const,
      // Json columns need Prisma.JsonNull, not SQL null.
      ['custom', body.custom === null ? Prisma.JsonNull : body.custom] as const,
    ].filter(([, v]) => v !== undefined),
  );
  const row = await prisma.bodyMeasurement.update({ where: { id: existing.id }, data });
  res.json({ measurement: serialize(row) });
});

router.delete('/:id', validate({ params: cuidParam('id') }), async (req, res) => {
  const existing = await prisma.bodyMeasurement.findFirst({
    where: { id: req.params.id as string, userId: uid(req).id },
    select: { id: true },
  });
  if (!existing) throw notFound('measurement');
  await prisma.bodyMeasurement.delete({ where: { id: existing.id } });
  res.status(204).end();
});

export default router;
