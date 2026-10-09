import { Router } from 'express';
import { z } from 'zod';
import { currentUser } from '../../middleware/auth.js';
import { cuidParam, validate } from '../../middleware/validate.js';
import { notFound } from '../../lib/errors.js';
import { listPersonalRecords } from './records.service.js';
import {
  computeStreak,
  getExerciseProgress,
  getMuscleGroupBalance,
  getTotals,
  getTrainedExercises,
  getVolumeTrend,
  getWeeklyActivity,
} from './stats.service.js';

const router = Router();

const overviewQuery = z.object({
  weeks: z.coerce.number().int().min(4).max(52).default(12),
  balanceDays: z.coerce.number().int().min(7).max(365).default(30),
});

/** Answers the only question that matters here: "am I improving?" */
router.get('/', validate({ query: overviewQuery }), async (req, res) => {
  const userId = currentUser(req).id;
  const { weeks, balanceDays } = req.query as unknown as z.infer<typeof overviewQuery>;

  const [totals, streak, volumeTrend, balance, activity] = await Promise.all([
    getTotals(userId),
    computeStreak(userId),
    getVolumeTrend(userId, weeks),
    getMuscleGroupBalance(userId, balanceDays),
    getWeeklyActivity(userId, 4),
  ]);

  res.json({ totals, streak, volumeTrend, muscleGroupBalance: balance, activity });
});

router.get('/exercises', async (req, res) => {
  res.json({ exercises: await getTrainedExercises(currentUser(req).id) });
});

router.get(
  '/exercises/:exerciseId',
  validate({ params: cuidParam('exerciseId'), query: z.object({ limit: z.coerce.number().int().min(5).max(200).default(60) }) }),
  async (req, res) => {
    const { limit } = req.query as unknown as { limit: number };
    const progress = await getExerciseProgress(currentUser(req).id, req.params.exerciseId as string, limit);
    if (!progress) throw notFound('exercise');
    res.json(progress);
  },
);

router.get(
  '/records',
  validate({ query: z.object({ exerciseId: z.string().min(1).optional() }) }),
  async (req, res) => {
    const { exerciseId } = req.query as unknown as { exerciseId?: string };
    res.json(await listPersonalRecords(currentUser(req).id, exerciseId));
  },
);

export default router;
