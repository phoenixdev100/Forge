import { Router } from 'express';
import { prisma } from './db/prisma.js';
import { requireAuth } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimit.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import muscleGroupRoutes from './modules/muscleGroups/muscleGroups.routes.js';
import taxonomyRoutes from './modules/taxonomy/taxonomy.routes.js';
import exerciseRoutes from './modules/exercises/exercises.routes.js';
import planRoutes from './modules/plans/plans.routes.js';
import scheduleRoutes from './modules/schedule/schedule.routes.js';
import sessionRoutes from './modules/sessions/sessions.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import progressRoutes from './modules/progress/progress.routes.js';
import goalRoutes from './modules/goals/goals.routes.js';
import measurementRoutes from './modules/measurements/measurements.routes.js';
import achievementRoutes from './modules/achievements/achievements.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

router.use('/auth', authRoutes);

// Everything past this point is private user data. Authorisation is enforced
// here AND scoped by userId inside every query - never on the client alone.
router.use(requireAuth, apiLimiter);

router.use('/users', usersRoutes);
router.use('/muscle-groups', muscleGroupRoutes);
router.use('/library', taxonomyRoutes);
router.use('/exercises', exerciseRoutes);
router.use('/plans', planRoutes);
router.use('/schedule', scheduleRoutes);
router.use('/sessions', sessionRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/progress', progressRoutes);
router.use('/goals', goalRoutes);
router.use('/measurements', measurementRoutes);
router.use('/achievements', achievementRoutes);
router.use('/admin', adminRoutes);

export default router;
