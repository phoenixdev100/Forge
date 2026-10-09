import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

const listQuery = z.object({
  includeInactive: z.coerce.boolean().default(false),
  /** `true` returns only top-level groups with their children nested. */
  tree: z.coerce.boolean().default(false),
});

/**
 * Muscle groups are a tree (Rear Delts -> Shoulders) so the library can be
 * extended with finer-grained targets without inventing new top-level groups.
 */
router.get('/', validate({ query: listQuery }), async (req, res) => {
  const { includeInactive, tree } = req.query as unknown as z.infer<typeof listQuery>;
  const where = includeInactive ? {} : { isActive: true };

  const groups = await prisma.muscleGroup.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      bodyRegion: true,
      colorHex: true,
      sortOrder: true,
      parentId: true,
      isActive: true,
      _count: { select: { primaryForExercises: true } },
    },
  });

  const mapped = groups.map(({ _count, ...g }) => ({ ...g, exerciseCount: _count.primaryForExercises }));

  if (!tree) {
    res.json({ muscleGroups: mapped });
    return;
  }

  const byParent = new Map<string | null, typeof mapped>();
  for (const group of mapped) {
    const key = group.parentId;
    const bucket = byParent.get(key) ?? [];
    bucket.push(group);
    byParent.set(key, bucket);
  }

  res.json({
    muscleGroups: (byParent.get(null) ?? []).map((group) => ({
      ...group,
      children: byParent.get(group.id) ?? [],
    })),
  });
});

export default router;
