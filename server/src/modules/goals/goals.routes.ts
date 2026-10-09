import { Router } from 'express';
import { z } from 'zod';
import { currentUser } from '../../middleware/auth.js';
import { cuidParam, isoDate, validate } from '../../middleware/validate.js';
import { GoalMetric, GoalStatus } from '../../generated/prisma/enums.js';
import * as service from './goals.service.js';

const router = Router();
const uid = currentUser;

const createGoalSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the goal a name.').max(120),
    metric: z.enum(GoalMetric),
    exerciseId: z.string().min(1).nullish(),
    targetValue: z.coerce.number().positive('Set a target above zero.').max(1_000_000),
    startValue: z.coerce.number().min(0).max(1_000_000).nullish(),
    currentValue: z.coerce.number().min(0).max(1_000_000).nullish(),
    unitLabel: z.string().trim().max(24).nullish(),
    deadline: isoDate.nullish(),
    notes: z.string().trim().max(600).nullish(),
  })
  .refine(
    (v) => !['EXERCISE_WEIGHT', 'EXERCISE_REPS', 'EXERCISE_ONE_RM'].includes(v.metric) || Boolean(v.exerciseId),
    { message: 'Pick the exercise this goal is for.', path: ['exerciseId'] },
  );

const updateGoalSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    targetValue: z.coerce.number().positive().max(1_000_000).optional(),
    currentValue: z.coerce.number().min(0).max(1_000_000).nullish(),
    unitLabel: z.string().trim().max(24).nullish(),
    deadline: isoDate.nullish(),
    status: z.enum(GoalStatus).optional(),
    notes: z.string().trim().max(600).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

router.get('/', async (req, res) => {
  res.json({ goals: await service.listGoals(uid(req).id) });
});

router.post('/', validate({ body: createGoalSchema }), async (req, res) => {
  res.status(201).json({ goal: await service.createGoal(uid(req).id, req.body) });
});

router.patch('/:goalId', validate({ params: cuidParam('goalId'), body: updateGoalSchema }), async (req, res) => {
  res.json({ goal: await service.updateGoal(uid(req).id, req.params.goalId as string, req.body) });
});

router.delete('/:goalId', validate({ params: cuidParam('goalId') }), async (req, res) => {
  await service.deleteGoal(uid(req).id, req.params.goalId as string);
  res.status(204).end();
});

export default router;
