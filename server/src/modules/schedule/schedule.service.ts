import { prisma } from '../../db/prisma.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { addDays, cyclePositionFor, eachDay, parseIsoDate, startOfUtcDay, startOfWeek, toIsoDate, todayFor, weekdayOf } from '../../lib/dates.js';
import { num } from '../../lib/serialize.js';
import { PlanDayType, SessionStatus } from '../../generated/prisma/enums.js';

export type DayState =
  | 'completed'
  | 'in_progress'
  | 'partial'
  | 'missed'
  | 'rest'
  | 'scheduled'
  | 'empty';

const scheduleDaySelect = {
  id: true,
  position: true,
  label: true,
  dayType: true,
  notes: true,
  estimatedMinutes: true,
  muscleGroups: {
    orderBy: { sortOrder: 'asc' },
    select: { muscleGroup: { select: { id: true, slug: true, name: true, colorHex: true } } },
  },
  _count: { select: { exercises: true } },
} as const;

type ScheduleDay = {
  id: string;
  position: number;
  label: string | null;
  dayType: PlanDayType;
  notes: string | null;
  estimatedMinutes: number | null;
  muscleGroups: Array<{ muscleGroup: { id: string; slug: string; name: string; colorHex: string } }>;
  _count: { exercises: number };
};

function describeDay(day: ScheduleDay | null) {
  if (!day) return null;
  const groups = day.muscleGroups.map((m) => m.muscleGroup);
  return {
    planDayId: day.id,
    position: day.position,
    dayType: day.dayType,
    label:
      day.label?.trim() ||
      (groups.length ? groups.map((g) => g.name).join(' + ') : day.dayType === PlanDayType.REST ? 'Rest' : 'Custom workout'),
    muscleGroups: groups,
    exerciseCount: day._count.exercises,
    estimatedMinutes: day.estimatedMinutes,
    notes: day.notes,
  };
}

/**
 * Resolves what the user is scheduled to do on each date in a range.
 *
 * Precedence: a `ScheduleOverride` for a specific date always beats the
 * recurring plan. That is what makes "change this Friday only" different from
 * "change every Friday".
 */
export async function resolveSchedule(userId: string, fromIso: string, toIso: string) {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (to < from) throw badRequest('The end date must be on or after the start date.');

  const dates = eachDay(from, to);
  if (dates.length > 400) throw badRequest('Please request a range of 400 days or fewer.');

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { weekStartsOn: true, timezone: true },
  });

  const [plan, overrides, sessions] = await Promise.all([
    prisma.workoutPlan.findFirst({
      where: { userId, isActive: true, archivedAt: null },
      select: {
        id: true,
        name: true,
        cycleLength: true,
        startsOn: true,
        days: { orderBy: { position: 'asc' }, select: scheduleDaySelect },
      },
    }),
    prisma.scheduleOverride.findMany({
      where: { userId, date: { gte: from, lte: to } },
      select: {
        date: true,
        isRest: true,
        note: true,
        planDay: { select: scheduleDaySelect },
      },
    }),
    prisma.workoutSession.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        date: true,
        title: true,
        status: true,
        startedAt: true,
        completedAt: true,
        durationSeconds: true,
        totalSets: true,
        totalVolumeKg: true,
        prCount: true,
        _count: { select: { exercises: true } },
      },
    }),
  ]);

  const today = todayFor(user.timezone);
  const daysByPosition = new Map((plan?.days ?? []).map((d) => [d.position, d as ScheduleDay]));
  const overrideByDate = new Map(overrides.map((o) => [toIsoDate(o.date), o]));
  const sessionsByDate = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = toIsoDate(session.date);
    const bucket = sessionsByDate.get(key) ?? [];
    bucket.push(session);
    sessionsByDate.set(key, bucket);
  }

  const entries = dates.map((date) => {
    const iso = toIsoDate(date);
    const override = overrideByDate.get(iso);

    let scheduled: ReturnType<typeof describeDay> = null;
    let isOverride = false;

    if (override) {
      isOverride = true;
      scheduled = override.isRest ? null : describeDay((override.planDay as ScheduleDay | null) ?? null);
    } else if (plan) {
      const position = cyclePositionFor(date, plan, user.weekStartsOn);
      scheduled = describeDay(daysByPosition.get(position) ?? null);
    }

    const daySessions = sessionsByDate.get(iso) ?? [];
    const completed = daySessions.find((s) => s.status === SessionStatus.COMPLETED);
    const active = daySessions.find((s) => s.status === SessionStatus.IN_PROGRESS);
    const session = completed ?? active ?? daySessions[0] ?? null;

    const isRest = Boolean(override?.isRest) || scheduled?.dayType === PlanDayType.REST;
    const comparedToToday = date.getTime() - today.getTime();

    let state: DayState;
    if (completed) state = 'completed';
    else if (active) state = 'in_progress';
    else if (isRest) state = 'rest';
    else if (!scheduled) state = 'empty';
    else if (comparedToToday < 0) state = 'missed';
    else state = 'scheduled';

    return {
      date: iso,
      isToday: comparedToToday === 0,
      isPast: comparedToToday < 0,
      isOverride,
      overrideNote: override?.note ?? null,
      state,
      scheduled,
      session: session
        ? {
            id: session.id,
            title: session.title,
            status: session.status,
            startedAt: session.startedAt.toISOString(),
            completedAt: session.completedAt?.toISOString() ?? null,
            durationSeconds: session.durationSeconds,
            totalSets: session.totalSets,
            totalVolumeKg: num(session.totalVolumeKg),
            prCount: session.prCount,
            exerciseCount: session._count.exercises,
          }
        : null,
    };
  });

  return {
    from: fromIso,
    to: toIso,
    today: toIsoDate(today),
    plan: plan ? { id: plan.id, name: plan.name, cycleLength: plan.cycleLength } : null,
    entries,
  };
}

export type ScheduleEntry = Awaited<ReturnType<typeof resolveSchedule>>['entries'][number];

/** What the dashboard's "Today's Workout" card and workout mode resolve against. */
export async function resolveDate(userId: string, iso: string): Promise<ScheduleEntry> {
  const { entries } = await resolveSchedule(userId, iso, iso);
  const entry = entries[0];
  if (!entry) throw notFound('day');
  return entry;
}

export async function upsertOverride(
  userId: string,
  iso: string,
  input: { planDayId?: string | null | undefined; isRest: boolean; note?: string | null | undefined },
) {
  const date = parseIsoDate(iso);

  if (input.planDayId) {
    const owned = await prisma.planDay.findFirst({
      where: { id: input.planDayId, plan: { userId } },
      select: { id: true },
    });
    if (!owned) throw notFound('workout day');
  }

  const data = {
    planDayId: input.planDayId ?? null,
    isRest: input.isRest,
    note: input.note ?? null,
  };

  await prisma.scheduleOverride.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  });

  return resolveDate(userId, iso);
}

/** Reverts a single date back to whatever the recurring plan says. */
export async function clearOverride(userId: string, iso: string) {
  await prisma.scheduleOverride.deleteMany({ where: { userId, date: parseIsoDate(iso) } });
  return resolveDate(userId, iso);
}

/**
 * "Missed Tuesday, so Tuesday's workout slides to Wednesday" - every date in
 * the week from `from` onward picks up the previous day's plan, cascading to
 * the end of that week. The recurring plan itself is never touched; the shift
 * materialises as one override row per date, so "Back to recurring" can undo
 * any single day afterwards.
 */
export async function shiftForward(userId: string, fromIso: string, ongoing = false) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { weekStartsOn: true, timezone: true },
  });
  const from = parseIsoDate(fromIso);
  const today = todayFor(user.timezone);
  const weekEnd = addDays(startOfWeek(from, user.weekStartsOn), 6);
  if (weekEnd <= from) throw badRequest('Nothing left this week to shift into.');

  const { entries } = await resolveSchedule(userId, toIsoDate(from), toIsoDate(weekEnd));

  // Snapshot what each date was scheduled for BEFORE writing overrides.
  const scheduledBefore = new Map(entries.map((e) => [e.date, e.scheduled?.planDayId ?? null]));

  const writes: Array<Promise<unknown>> = [];
  for (let i = 1; i < entries.length; i += 1) {
    const target = entries[i];
    const prev = entries[i - 1];
    if (!target || !prev || target.session) continue; // never clobber a day that already has a session
    const prevPlanDayId = scheduledBefore.get(prev.date) ?? null;
    const targetDate = parseIsoDate(target.date);
    writes.push(
      prisma.scheduleOverride.upsert({
        where: { userId_date: { userId, date: targetDate } },
        create: { userId, date: targetDate, planDayId: prevPlanDayId, isRest: !prevPlanDayId, note: 'Shifted forward' },
        update: { planDayId: prevPlanDayId, isRest: !prevPlanDayId, note: 'Shifted forward' },
      }),
    );
  }

  // The shifted-from day itself: today/future becomes a rest day (the workout
  // moved to tomorrow); a past day stays exactly as history recorded it.
  if (from >= today && !entries[0]?.session) {
    writes.push(
      prisma.scheduleOverride.upsert({
        where: { userId_date: { userId, date: from } },
        create: { userId, date: from, planDayId: null, isRest: true, note: 'Skipped - shifted forward' },
        update: { planDayId: null, isRest: true, note: 'Skipped - shifted forward' },
      }),
    );
  }

  await Promise.all(writes);

  // "Keep the rhythm": bump the cycle anchor one day so every future date
  // permanently resolves to what the previous day had planned - the offset
  // persists into next week and beyond, instead of snapping back.
  if (ongoing) {
    const plan = await prisma.workoutPlan.findFirst({
      where: { userId, isActive: true, archivedAt: null },
      select: { id: true, startsOn: true },
    });
    if (plan) {
      let next: Date;
      if (plan.startsOn) {
        next = addDays(startOfUtcDay(plan.startsOn), 1);
      } else {
        // A 7-day plan without startsOn rides the weekday grid. Anchoring it
        // on the weekday AFTER the user's week start puts every future date
        // exactly one plan position back - same effect as anchor + 1.
        const wanted = (user.weekStartsOn + 1) % 7;
        next = startOfUtcDay(from);
        while (weekdayOf(next) !== wanted) next = addDays(next, -1);
      }
      await prisma.workoutPlan.update({ where: { id: plan.id }, data: { startsOn: next } });
    }
  }

  return resolveDate(userId, toIsoDate(from));
}
