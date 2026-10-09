import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import {
  Difficulty,
  Mechanic,
  MovementType,
  TrackingType,
} from '../../generated/prisma/enums.js';

const router = Router();

router.get('/equipment', async (_req, res) => {
  const equipment = await prisma.equipment.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      iconKey: true,
      _count: { select: { exercises: true } },
    },
  });
  res.json({
    equipment: equipment.map(({ _count, ...e }) => ({ ...e, exerciseCount: _count.exercises })),
  });
});

router.get('/categories', async (_req, res) => {
  const categories = await prisma.exerciseCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      _count: { select: { exercises: true } },
    },
  });
  res.json({
    categories: categories.map(({ _count, ...c }) => ({ ...c, exerciseCount: _count.exercises })),
  });
});

/**
 * Enum vocabularies, so filter UIs and selects are driven by the API rather
 * than duplicated string literals on the client.
 */
router.get('/filters', (_req, res) => {
  res.json({
    difficulties: Object.values(Difficulty),
    mechanics: Object.values(Mechanic),
    movementTypes: Object.values(MovementType),
    trackingTypes: Object.values(TrackingType),
  });
});

export default router;
