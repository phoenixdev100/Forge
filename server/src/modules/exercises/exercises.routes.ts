import { Router } from 'express';
import { z } from 'zod';
import { currentUser } from '../../middleware/auth.js';
import { cuidParam, validate } from '../../middleware/validate.js';
import * as service from './exercises.service.js';
import {
  createCustomExerciseSchema,
  exerciseNoteSchema,
  listExercisesQuery,
  updateCustomExerciseSchema,
} from './exercises.schemas.js';

const router = Router();

router.get('/', validate({ query: listExercisesQuery }), async (req, res) => {
  const query = req.query as unknown as z.infer<typeof listExercisesQuery>;
  res.json(await service.listExercises(currentUser(req).id, query));
});

/** Custom exercises are created through the same picker as library search. */
router.post('/', validate({ body: createCustomExerciseSchema }), async (req, res) => {
  const exercise = await service.createCustomExercise(currentUser(req).id, req.body);
  res.status(201).json({ exercise });
});

router.get('/:idOrSlug', validate({ params: cuidParam('idOrSlug') }), async (req, res) => {
  res.json(await service.getExercise(currentUser(req).id, req.params.idOrSlug as string));
});

router.patch(
  '/:id',
  validate({ params: cuidParam('id'), body: updateCustomExerciseSchema }),
  async (req, res) => {
    const exercise = await service.updateCustomExercise(currentUser(req).id, req.params.id as string, req.body);
    res.json({ exercise });
  },
);

router.delete('/:id', validate({ params: cuidParam('id') }), async (req, res) => {
  const result = await service.deleteCustomExercise(currentUser(req).id, req.params.id as string);
  res.json(result);
});

router.put(
  '/:id/note',
  validate({ params: cuidParam('id'), body: exerciseNoteSchema }),
  async (req, res) => {
    const note = await service.upsertNote(currentUser(req).id, req.params.id as string, req.body.body);
    res.json({ note });
  },
);

export default router;
