import { Router } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { cuidParam, validate } from '../../middleware/validate.js';
import * as service from './plans.service.js';
import {
  addPlanExerciseSchema,
  addPlanExercisesSchema,
  createDaySchema,
  createPlanSchema,
  duplicateDaySchema,
  reorderSchema,
  setDayMuscleGroupsSchema,
  setPlannedSetsSchema,
  updateDaySchema,
  updatePlanExerciseSchema,
  updatePlanSchema,
} from './plans.schemas.js';

const router = Router();
const uid = currentUser;

// --- Templates (optional starting points, copied into an editable plan) -----

router.get('/templates', async (_req, res) => {
  res.json({ templates: await service.listTemplates() });
});

// --- Plans -----------------------------------------------------------------

router.get('/', async (req, res) => {
  res.json({ plans: await service.listPlans(uid(req).id) });
});

router.get('/active', async (req, res) => {
  res.json({ plan: await service.getActivePlan(uid(req).id) });
});

router.post('/', validate({ body: createPlanSchema }), async (req, res) => {
  res.status(201).json({ plan: await service.createPlan(uid(req).id, req.body) });
});

router.get('/:planId', validate({ params: cuidParam('planId') }), async (req, res) => {
  res.json({ plan: await service.getPlan(uid(req).id, req.params.planId as string) });
});

router.patch(
  '/:planId',
  validate({ params: cuidParam('planId'), body: updatePlanSchema }),
  async (req, res) => {
    res.json({ plan: await service.updatePlan(uid(req).id, req.params.planId as string, req.body) });
  },
);

router.post('/:planId/activate', validate({ params: cuidParam('planId') }), async (req, res) => {
  res.json({ plan: await service.activatePlan(uid(req).id, req.params.planId as string) });
});

router.post('/:planId/duplicate', validate({ params: cuidParam('planId') }), async (req, res) => {
  res.status(201).json({ plan: await service.duplicatePlan(uid(req).id, req.params.planId as string) });
});

router.delete('/:planId', validate({ params: cuidParam('planId') }), async (req, res) => {
  await service.deletePlan(uid(req).id, req.params.planId as string);
  res.status(204).end();
});

// --- Days ------------------------------------------------------------------

router.post(
  '/:planId/days',
  validate({ params: cuidParam('planId'), body: createDaySchema }),
  async (req, res) => {
    res.status(201).json({ day: await service.createDay(uid(req).id, req.params.planId as string, req.body) });
  },
);

router.patch('/days/:dayId', validate({ params: cuidParam('dayId'), body: updateDaySchema }), async (req, res) => {
  res.json({ day: await service.updateDay(uid(req).id, req.params.dayId as string, req.body) });
});

router.delete('/days/:dayId', validate({ params: cuidParam('dayId') }), async (req, res) => {
  await service.deleteDay(uid(req).id, req.params.dayId as string);
  res.status(204).end();
});

router.post(
  '/days/:dayId/duplicate',
  validate({ params: cuidParam('dayId'), body: duplicateDaySchema }),
  async (req, res) => {
    res.status(201).json({ day: await service.duplicateDay(uid(req).id, req.params.dayId as string, req.body) });
  },
);

/** Replaces the day's muscle groups - zero, one, or many are all valid. */
router.put(
  '/days/:dayId/muscle-groups',
  validate({ params: cuidParam('dayId'), body: setDayMuscleGroupsSchema }),
  async (req, res) => {
    const day = await service.setDayMuscleGroups(uid(req).id, req.params.dayId as string, req.body.muscleGroupIds);
    res.json({ day });
  },
);

// --- Exercises within a day ------------------------------------------------

router.post(
  '/days/:dayId/exercises',
  validate({ params: cuidParam('dayId'), body: addPlanExerciseSchema }),
  async (req, res) => {
    const planExercise = await service.addPlanExercise(uid(req).id, req.params.dayId as string, req.body);
    res.status(201).json({ planExercise });
  },
);

router.post(
  '/days/:dayId/exercises/bulk',
  validate({ params: cuidParam('dayId'), body: addPlanExercisesSchema }),
  async (req, res) => {
    const exercises = await service.addPlanExercises(uid(req).id, req.params.dayId as string, req.body);
    res.status(201).json({ exercises });
  },
);

router.put(
  '/days/:dayId/exercises/order',
  validate({ params: cuidParam('dayId'), body: reorderSchema }),
  async (req, res) => {
    const exercises = await service.reorderPlanExercises(uid(req).id, req.params.dayId as string, req.body.orderedIds);
    res.json({ exercises });
  },
);

router.patch(
  '/exercises/:planExerciseId',
  validate({ params: cuidParam('planExerciseId'), body: updatePlanExerciseSchema }),
  async (req, res) => {
    const planExercise = await service.updatePlanExercise(
      uid(req).id,
      req.params.planExerciseId as string,
      req.body,
    );
    res.json({ planExercise });
  },
);

router.delete(
  '/exercises/:planExerciseId',
  validate({ params: cuidParam('planExerciseId') }),
  async (req, res) => {
    await service.removePlanExercise(uid(req).id, req.params.planExerciseId as string);
    res.status(204).end();
  },
);

router.post(
  '/exercises/:planExerciseId/duplicate',
  validate({ params: cuidParam('planExerciseId') }),
  async (req, res) => {
    const planExercise = await service.duplicatePlanExercise(uid(req).id, req.params.planExerciseId as string);
    res.status(201).json({ planExercise });
  },
);

/** Per-set targets for pyramids/ramp-ups; empty array reverts to uniform sets. */
router.put(
  '/exercises/:planExerciseId/sets',
  validate({ params: cuidParam('planExerciseId'), body: setPlannedSetsSchema }),
  async (req, res) => {
    const planExercise = await service.setPlannedSets(uid(req).id, req.params.planExerciseId as string, req.body);
    res.json({ planExercise });
  },
);

export default router;
