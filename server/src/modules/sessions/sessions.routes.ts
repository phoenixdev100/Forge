import { Router } from 'express';
import type { z } from 'zod';
import { currentUser } from '../../middleware/auth.js';
import { cuidParam, validate } from '../../middleware/validate.js';
import * as service from './sessions.service.js';
import {
  addSessionExerciseSchema,
  addSetSchema,
  completeSessionSchema,
  listSessionsQuery,
  logSetSchema,
  reorderSessionExercisesSchema,
  startSessionSchema,
  updateSessionExerciseSchema,
  updateSessionSchema,
} from './sessions.schemas.js';

const router = Router();
const uid = currentUser;

// --- Reading ---------------------------------------------------------------

/** Workout history. */
router.get('/', validate({ query: listSessionsQuery }), async (req, res) => {
  const query = req.query as unknown as z.infer<typeof listSessionsQuery>;
  res.json(await service.listSessions(uid(req).id, query));
});

/** Lets the client restore an interrupted workout on launch. */
router.get('/active', async (req, res) => {
  res.json({ session: await service.getActiveSession(uid(req).id) });
});

// --- Workout lifecycle -----------------------------------------------------

/** Idempotent: starting twice on the same date resumes the open session. */
router.post('/start', validate({ body: startSessionSchema }), async (req, res) => {
  res.status(201).json({ session: await service.startSession(uid(req).id, req.body) });
});

// --- Sets (declared before /:sessionId so they are not shadowed) -----------

router.patch('/sets/:setId', validate({ params: cuidParam('setId'), body: logSetSchema }), async (req, res) => {
  res.json({ set: await service.logSet(uid(req).id, req.params.setId as string, req.body) });
});

router.delete('/sets/:setId', validate({ params: cuidParam('setId') }), async (req, res) => {
  await service.deleteSet(uid(req).id, req.params.setId as string);
  res.status(204).end();
});

// --- Exercises within a workout -------------------------------------------

router.patch(
  '/exercises/:sessionExerciseId',
  validate({ params: cuidParam('sessionExerciseId'), body: updateSessionExerciseSchema }),
  async (req, res) => {
    const exercise = await service.updateSessionExercise(
      uid(req).id,
      req.params.sessionExerciseId as string,
      req.body,
    );
    res.json({ exercise });
  },
);

router.delete(
  '/exercises/:sessionExerciseId',
  validate({ params: cuidParam('sessionExerciseId') }),
  async (req, res) => {
    await service.removeSessionExercise(uid(req).id, req.params.sessionExerciseId as string);
    res.status(204).end();
  },
);

/** Extra sets beyond the plan - no restriction on how many. */
router.post(
  '/exercises/:sessionExerciseId/sets',
  validate({ params: cuidParam('sessionExerciseId'), body: addSetSchema }),
  async (req, res) => {
    const set = await service.addSet(uid(req).id, req.params.sessionExerciseId as string, req.body);
    res.status(201).json({ set });
  },
);

// --- A specific workout ----------------------------------------------------

router.get('/:sessionId', validate({ params: cuidParam('sessionId') }), async (req, res) => {
  res.json({ session: await service.getSession(uid(req).id, req.params.sessionId as string) });
});

router.patch(
  '/:sessionId',
  validate({ params: cuidParam('sessionId'), body: updateSessionSchema }),
  async (req, res) => {
    res.json({ session: await service.updateSession(uid(req).id, req.params.sessionId as string, req.body) });
  },
);

router.post(
  '/:sessionId/complete',
  validate({ params: cuidParam('sessionId'), body: completeSessionSchema }),
  async (req, res) => {
    res.json(await service.completeSession(uid(req).id, req.params.sessionId as string, req.body));
  },
);

/** Edit a finished workout: flips it back to in-progress; completing saves it again. */
router.post('/:sessionId/reopen', validate({ params: cuidParam('sessionId') }), async (req, res) => {
  res.json({ session: await service.reopenSession(uid(req).id, req.params.sessionId as string) });
});

router.post('/:sessionId/abandon', validate({ params: cuidParam('sessionId') }), async (req, res) => {
  await service.abandonSession(uid(req).id, req.params.sessionId as string);
  res.status(204).end();
});

router.delete('/:sessionId', validate({ params: cuidParam('sessionId') }), async (req, res) => {
  await service.deleteSession(uid(req).id, req.params.sessionId as string);
  res.status(204).end();
});

router.post(
  '/:sessionId/exercises',
  validate({ params: cuidParam('sessionId'), body: addSessionExerciseSchema }),
  async (req, res) => {
    const exercise = await service.addSessionExercise(uid(req).id, req.params.sessionId as string, req.body);
    res.status(201).json({ exercise });
  },
);

router.put(
  '/:sessionId/exercises/order',
  validate({ params: cuidParam('sessionId'), body: reorderSessionExercisesSchema }),
  async (req, res) => {
    const session = await service.reorderSessionExercises(
      uid(req).id,
      req.params.sessionId as string,
      req.body.orderedIds,
    );
    res.json({ session });
  },
);

export default router;
