import { prisma } from '../../db/prisma.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { num, type Decimalish } from '../../lib/serialize.js';
import { addDays, parseIsoDate, startOfWeek, toIsoDate, todayFor } from '../../lib/dates.js';
import { GoalMetric, GoalStatus, PrType, SessionStatus } from '../../generated/prisma/enums.js';

type DecimalishValue = Decimalish;

type GoalRow = {
  id: string;
  title: string;
  metric: GoalMetric;
  exerciseId: string | null;
  targetValue: DecimalishValue;
  startValue: DecimalishValue;
  currentValue: DecimalishValue;
  unitLabel: string | null;
  deadline: Date | null;
  status: GoalStatus;
  notes: string | null;
  achievedAt: Date | null;
  createdAt: Date;
  exercise?: { id: string; slug: string; name: string } | null;
};

/**
 * Live progress per metric. Auto-computed goals (weight, reps, workouts…) are
 * measured from real data on every read; `CUSTOM` reads the stored value.
 */
async function currentValueFor(userId: string, goal: GoalRow): Promise<number> {
  switch (goal.metric) {
    case GoalMetric.EXERCISE_WEIGHT:
    case GoalMetric.EXERCISE_REPS:
    case GoalMetric.EXERCISE_ONE_RM: {
      if (!goal.exerciseId) return num(goal.currentValue) ?? 0;
      const type =
        goal.metric === GoalMetric.EXERCISE_WEIGHT
          ? PrType.MAX_WEIGHT
          : goal.metric === GoalMetric.EXERCISE_REPS
            ? PrType.MAX_REPS
            : PrType.EST_ONE_RM;
      const best = await prisma.personalRecord.findFirst({
        where: { userId, exerciseId: goal.exerciseId, type },
        orderBy: { value: 'desc' },
        select: { value: true },
      });
      return num(best?.value) ?? num(goal.startValue) ?? 0;
    }
    case GoalMetric.WORKOUTS_PER_WEEK: {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true, weekStartsOn: true } });
      const today = todayFor(user.timezone);
      const weekStart = startOfWeek(today, user.weekStartsOn);
      return prisma.workoutSession.count({
        where: { userId, status: SessionStatus.COMPLETED, date: { gte: weekStart, lte: addDays(weekStart, 6) } },
      });
    }
    case GoalMetric.TOTAL_WORKOUTS:
      return prisma.workoutSession.count({ where: { userId, status: SessionStatus.COMPLETED } });
    case GoalMetric.TOTAL_VOLUME: {
      const sum = await prisma.workoutSession.aggregate({
        where: { userId, status: SessionStatus.COMPLETED },
        _sum: { totalVolumeKg: true },
      });
      return num(sum._sum.totalVolumeKg) ?? 0;
    }
    case GoalMetric.BODY_WEIGHT:
    case GoalMetric.BODY_FAT: {
      const latest = await prisma.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: { measuredOn: 'desc' },
        select: { bodyWeightKg: true, bodyFatPct: true },
      });
      const value = goal.metric === GoalMetric.BODY_WEIGHT ? num(latest?.bodyWeightKg) : num(latest?.bodyFatPct);
      return value ?? num(goal.currentValue) ?? 0;
    }
    case GoalMetric.CUSTOM:
    default:
      return num(goal.currentValue) ?? 0;
  }
}

async function serializeGoal(userId: string, goal: GoalRow) {
  const current = await currentValueFor(userId, goal);
  const target = num(goal.targetValue) ?? 0;
  const start = num(goal.startValue) ?? 0;
  // Progress is measured across the gap between baseline and target, not 0→target.
  const progress = target === start ? (current >= target ? 1 : 0) : Math.min(1, Math.max(0, (current - start) / (target - start)));
  const achieved = goal.status === GoalStatus.ACHIEVED || current >= target;

  return {
    id: goal.id,
    title: goal.title,
    metric: goal.metric,
    exercise: goal.exercise ?? null,
    targetValue: target,
    startValue: start,
    currentValue: current,
    unitLabel: goal.unitLabel,
    deadline: goal.deadline ? toIsoDate(goal.deadline) : null,
    status: achieved && goal.status === GoalStatus.ACTIVE ? 'ACHIEVED' : goal.status,
    progress,
    isAutoTracked: goal.metric !== GoalMetric.CUSTOM,
    notes: goal.notes,
    achievedAt: goal.achievedAt?.toISOString() ?? null,
    createdAt: goal.createdAt.toISOString(),
  };
}

const goalSelect = {
  id: true,
  title: true,
  metric: true,
  exerciseId: true,
  targetValue: true,
  startValue: true,
  currentValue: true,
  unitLabel: true,
  deadline: true,
  status: true,
  notes: true,
  achievedAt: true,
  createdAt: true,
  exercise: { select: { id: true, slug: true, name: true } },
} as const;

export async function listGoals(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId, status: { not: GoalStatus.ARCHIVED } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: goalSelect,
  });
  return Promise.all(goals.map((g) => serializeGoal(userId, g as GoalRow)));
}

export async function createGoal(userId: string, input: {
  title: string;
  metric: GoalMetric;
  exerciseId?: string | null;
  targetValue: number;
  startValue?: number | null;
  currentValue?: number | null;
  unitLabel?: string | null;
  deadline?: string | null;
  notes?: string | null;
}) {
  if (input.exerciseId) {
    const exercise = await prisma.exercise.findFirst({
      where: { id: input.exerciseId, OR: [{ isCustom: false }, { isCustom: true, createdById: userId }] },
      select: { id: true },
    });
    if (!exercise) throw badRequest('That exercise is not available.', { exerciseId: 'Pick an exercise from the library or your own.' });
  }

  const goal = await prisma.goal.create({
    data: {
      userId,
      title: input.title,
      metric: input.metric,
      exerciseId: input.exerciseId ?? null,
      targetValue: input.targetValue,
      startValue: input.startValue ?? null,
      currentValue: input.currentValue ?? 0,
      unitLabel: input.unitLabel ?? null,
      deadline: input.deadline ? parseIsoDate(input.deadline) : null,
      notes: input.notes ?? null,
    },
    select: goalSelect,
  });
  return serializeGoal(userId, goal as GoalRow);
}

export async function updateGoal(userId: string, goalId: string, input: {
  title?: string;
  targetValue?: number;
  currentValue?: number | null;
  unitLabel?: string | null;
  deadline?: string | null;
  status?: GoalStatus;
  notes?: string | null;
}) {
  const existing = await prisma.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
  if (!existing) throw notFound('goal');

  const becomingAchieved = input.status === GoalStatus.ACHIEVED;
  const goal = await prisma.goal.update({
    where: { id: goalId },
    data: {
      ...Object.fromEntries(
        Object.entries({
          title: input.title,
          targetValue: input.targetValue,
          currentValue: input.currentValue,
          unitLabel: input.unitLabel,
          status: input.status,
          notes: input.notes,
        }).filter(([, v]) => v !== undefined),
      ),
      ...(input.deadline !== undefined ? { deadline: input.deadline ? parseIsoDate(input.deadline) : null } : {}),
      ...(becomingAchieved ? { achievedAt: new Date() } : {}),
    },
    select: goalSelect,
  });
  return serializeGoal(userId, goal as GoalRow);
}

export async function deleteGoal(userId: string, goalId: string) {
  const existing = await prisma.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
  if (!existing) throw notFound('goal');
  await prisma.goal.delete({ where: { id: goalId } });
}
