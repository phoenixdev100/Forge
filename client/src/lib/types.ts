/** Mirrors the server's serializers. Kept hand-written and small on purpose. */

import type { Unit } from './units';

export type Role = 'USER' | 'ADMIN';
export type FitnessGoal = 'BUILD_MUSCLE' | 'STRENGTH' | 'FAT_LOSS' | 'GENERAL_FITNESS' | 'CUSTOM';
export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type Mechanic = 'COMPOUND' | 'ISOLATION' | 'UNKNOWN';
export type MediaType = 'NONE' | 'IMAGE' | 'GIF' | 'VIDEO';
export type PlanDayType = 'WORKOUT' | 'REST';
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type SetType = 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE' | 'AMRAP' | 'BACKOFF';
export type DayState = 'completed' | 'in_progress' | 'partial' | 'missed' | 'rest' | 'scheduled' | 'empty';

export type TrackingType =
  | 'WEIGHT_REPS'
  | 'BODYWEIGHT_REPS'
  | 'WEIGHTED_BODYWEIGHT'
  | 'REPS_ONLY'
  | 'TIME'
  | 'WEIGHTED_TIME'
  | 'DISTANCE_TIME'
  | 'AMRAP';

export type MovementType =
  | 'PUSH'
  | 'PULL'
  | 'SQUAT'
  | 'HINGE'
  | 'LUNGE'
  | 'CARRY'
  | 'ROTATION'
  | 'ISOMETRIC'
  | 'CARDIO'
  | 'MOBILITY'
  | 'OLYMPIC'
  | 'OTHER';

export type PrType =
  | 'MAX_WEIGHT'
  | 'MAX_REPS'
  | 'MAX_SET_VOLUME'
  | 'MAX_SESSION_VOLUME'
  | 'EST_ONE_RM'
  | 'BEST_TIME'
  | 'BEST_DISTANCE';

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  unit: Unit;
  goal: FitnessGoal | null;
  experience: ExperienceLevel | null;
  trainingDaysPerWeek: number | null;
  heightCm: number | null;
  bodyWeightKg: number | null;
  dateOfBirth: string | null;
  timezone: string;
  weekStartsOn: number;
  onboardedAt: string | null;
  createdAt: string | null;
};

export type MuscleGroup = {
  id: string;
  slug: string;
  name: string;
  colorHex: string;
  bodyRegion?: string;
  parentId?: string | null;
  sortOrder?: number;
  exerciseCount?: number;
  children?: MuscleGroup[];
};

export type Equipment = { id: string; slug: string; name: string; iconKey: string | null; exerciseCount?: number };
export type Category = { id: string; slug: string; name: string; description: string | null; exerciseCount?: number };

export type ExerciseMedia = {
  type: MediaType;
  posterUrl: string | null;
  loopUrl: string | null;
  frames: string[];
  isVideo: boolean;
  canAnimate: boolean;
  hasMedia: boolean;
};

export type Exercise = {
  id: string;
  slug: string;
  name: string;
  difficulty: Difficulty;
  mechanic: Mechanic;
  movementType: MovementType;
  trackingType: TrackingType;
  isUnilateral: boolean;
  defaultRestSeconds: number;
  isCustom: boolean;
  popularity: number;
  media: ExerciseMedia;
  primaryMuscle: MuscleGroup;
  equipment: Equipment | null;
  category: Pick<Category, 'id' | 'slug' | 'name'> | null;
};

export type ExerciseDetail = Exercise & {
  description: string | null;
  instructions: string[];
  commonMistakes: string[];
  tips: string[];
  breathing: string | null;
  aliases: string[];
  mediaAttribution: string | null;
  secondaryMuscles: MuscleGroup[];
  createdById: string | null;
};

export type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

export type PlanSet = {
  id: string;
  setNumber: number;
  setType: SetType;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetTimeSeconds: number | null;
  targetDistanceM: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type PlanExercise = {
  id: string;
  sortOrder: number;
  muscleGroupId: string | null;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetTimeSeconds: number | null;
  targetDistanceM: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
  trackingType: TrackingType | null;
  notes: string | null;
  supersetKey: string | null;
  effectiveTrackingType: TrackingType;
  effectiveRestSeconds: number;
  exercise: Exercise;
  plannedSets: PlanSet[];
};

export type PlanDay = {
  id: string;
  position: number;
  label: string | null;
  dayType: PlanDayType;
  notes: string | null;
  estimatedMinutes: number | null;
  muscleGroups: Array<MuscleGroup & { sortOrder: number; rowId: string }>;
  exercises: PlanExercise[];
  positionLabel: string;
  displayLabel: string;
  exerciseCount: number;
  plannedSetCount: number;
};

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  cycleLength: number;
  startsOn: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  days: PlanDay[];
  workoutDayCount: number;
  totalExerciseCount: number;
};

export type PlanSummary = {
  id: string;
  name: string;
  description: string | null;
  cycleLength: number;
  startsOn: string | null;
  isActive: boolean;
  updatedAt: string;
  workoutDayCount: number;
  exerciseCount: number;
  days: Array<{
    id: string;
    position: number;
    dayType: PlanDayType;
    label: string | null;
    muscleGroups: MuscleGroup[];
    exerciseCount: number;
  }>;
};

export type PlanTemplate = {
  slug: string;
  name: string;
  description: string;
  goal: FitnessGoal | null;
  difficulty: Difficulty;
  daysPerWeek: number;
  cycleLength: number;
};

export type SessionSet = {
  id: string;
  setNumber: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  timeSeconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  notes: string | null;
  volumeKg: number | null;
  estimatedOneRmKg: number | null;
};

export type SessionExercise = {
  id: string;
  sortOrder: number;
  planExerciseId: string | null;
  muscleGroupId: string | null;
  nameSnapshot: string;
  trackingType: TrackingType;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
  notes: string | null;
  isSkipped: boolean;
  completedAt: string | null;
  exercise: Exercise;
  muscleGroup: MuscleGroup | null;
  sets: SessionSet[];
  progress: {
    plannedSets: number | null;
    loggedSets: number;
    workingSets: number;
    completedSets: number;
    isComplete: boolean;
    volumeKg: number;
  };
};

export type PreviousPerformance = {
  exerciseId: string;
  sessionId: string;
  date: string;
  title: string;
  sets: Array<{
    setNumber: number;
    setType: SetType;
    weightKg: number | null;
    reps: number | null;
    timeSeconds: number | null;
    distanceM: number | null;
  }>;
  bestSet: { weightKg: number | null; reps: number | null; estimatedOneRmKg: number | null } | null;
  totalVolumeKg: number;
};

export type WorkoutSession = {
  id: string;
  planId: string | null;
  planDayId: string | null;
  date: string;
  title: string;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  notes: string | null;
  feeling: number | null;
  unit: Unit;
  totalVolumeKg: number | null;
  totalSets: number;
  totalReps: number;
  prCount: number;
  muscleGroups: MuscleGroup[];
  exercises: SessionExercise[];
  summary: {
    exerciseCount: number;
    completedExerciseCount: number;
    loggedSetCount: number;
    completedSetCount: number;
    volumeKg: number;
  };
  previousPerformance: Record<string, PreviousPerformance>;
};

export type SessionListItem = {
  id: string;
  date: string;
  title: string;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  totalVolumeKg: number | null;
  totalSets: number;
  totalReps: number;
  prCount: number;
  feeling: number | null;
  notes: string | null;
  muscleGroups: MuscleGroup[];
  exerciseCount: number;
};

export type ScheduledDay = {
  planDayId: string;
  position: number;
  dayType: PlanDayType;
  label: string;
  muscleGroups: MuscleGroup[];
  exerciseCount: number;
  estimatedMinutes: number | null;
  notes: string | null;
};

export type ScheduleEntry = {
  date: string;
  isToday: boolean;
  isPast: boolean;
  isOverride: boolean;
  overrideNote: string | null;
  state: DayState;
  scheduled: ScheduledDay | null;
  session: {
    id: string;
    title: string;
    status: SessionStatus;
    startedAt: string;
    completedAt: string | null;
    durationSeconds: number | null;
    totalSets: number;
    totalVolumeKg: number | null;
    prCount: number;
    exerciseCount: number;
  } | null;
};

export type Schedule = {
  from: string;
  to: string;
  today: string;
  plan: { id: string; name: string; cycleLength: number } | null;
  entries: ScheduleEntry[];
};

export type Streak = { current: number; longest: number; lastTrainedOn: string | null };

export type Totals = {
  totalWorkouts: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  totalDurationSeconds: number;
  totalPrs: number;
  uniqueExercises: number;
  thisWeek: { workouts: number; volumeKg: number; sets: number; weekStart: string };
  last30Days: { workouts: number; volumeKg: number; sets: number };
};

export type ActivityDay = { date: string; workouts: number; volumeKg: number; sets: number; titles: string[] };

export type PersonalRecord = {
  id: string;
  type: PrType;
  value: number;
  previousValue: number | null;
  weightKg: number | null;
  reps: number | null;
  timeSeconds?: number | null;
  achievedAt: string;
  sessionId?: string | null;
  exercise: { id: string; slug: string; name: string; thumbnailUrl?: string | null; primaryMuscle?: MuscleGroup };
};

export type Dashboard = {
  today: ScheduleEntry | null;
  upcoming: ScheduleEntry[];
  activeSession: { id: string; title: string; date: string; startedAt: string } | null;
  streak: Streak;
  totals: Totals;
  weeklyActivity: ActivityDay[];
  recentPersonalRecords: PersonalRecord[];
  plan: { id: string; name: string; cycleLength: number } | null;
  state: { hasPlan: boolean; planCount: number; hasTrained: boolean; needsOnboarding: boolean };
  unit: Unit;
};

export type VolumePoint = { weekStart: string; workouts: number; volumeKg: number; sets: number; minutes: number };

export type MuscleBalance = {
  id: string;
  slug: string;
  name: string;
  colorHex: string;
  sets: number;
  volumeKg: number;
  exercises: number;
};

export type ProgressOverview = {
  totals: Totals;
  streak: Streak;
  volumeTrend: VolumePoint[];
  muscleGroupBalance: MuscleBalance[];
  activity: ActivityDay[];
};

export type ExerciseProgressPoint = {
  sessionId: string;
  date: string;
  sets: number;
  maxWeightKg: number;
  maxReps: number;
  totalReps: number;
  volumeKg: number;
  estimatedOneRmKg: number;
};

export type ExerciseProgress = {
  exercise: {
    id: string;
    slug: string;
    name: string;
    trackingType: TrackingType;
    thumbnailUrl: string | null;
    primaryMuscle: MuscleGroup;
  };
  points: ExerciseProgressPoint[];
  totals: {
    sessions: number;
    sets: number;
    volumeKg: number;
    maxWeightKg: number;
    maxReps: number;
    maxVolumeKg: number;
    maxOneRmKg: number;
  };
};

export type GoalMetric =
  | 'EXERCISE_WEIGHT'
  | 'EXERCISE_REPS'
  | 'EXERCISE_ONE_RM'
  | 'WORKOUTS_PER_WEEK'
  | 'TOTAL_WORKOUTS'
  | 'BODY_WEIGHT'
  | 'BODY_FAT'
  | 'TOTAL_VOLUME'
  | 'CUSTOM';

export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'PAUSED' | 'ARCHIVED';

export type Goal = {
  id: string;
  title: string;
  metric: GoalMetric;
  exercise: { id: string; slug: string; name: string } | null;
  targetValue: number;
  startValue: number;
  currentValue: number;
  unitLabel: string | null;
  deadline: string | null;
  status: GoalStatus;
  progress: number;
  isAutoTracked: boolean;
  notes: string | null;
  achievedAt: string | null;
  createdAt: string;
};

export type BodyMeasurement = {
  id: string;
  measuredOn: string;
  bodyWeightKg: number | null;
  bodyFatPct: number | null;
  neckCm: number | null;
  shouldersCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  leftArmCm: number | null;
  rightArmCm: number | null;
  leftThighCm: number | null;
  rightThighCm: number | null;
  leftCalfCm: number | null;
  rightCalfCm: number | null;
  custom: Record<string, number> | null;
  notes: string | null;
};

export type AchievementCategory = 'MILESTONE' | 'CONSISTENCY' | 'STRENGTH' | 'VOLUME' | 'EXPLORATION';

export type Achievement = {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string | null;
  category: AchievementCategory;
  metric: string;
  threshold: number;
  progress: number;
  unlockedAt: string | null;
};

export type AdminExerciseRow = {
  id: string;
  slug: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  difficulty: Difficulty;
  popularity: number;
  isCustom: boolean;
  thumbnailUrl: string | null;
  timesPerformed: number;
  updatedAt: string;
  primaryMuscle: { id: string; slug: string; name: string; colorHex: string };
  equipment: { id: string; slug: string; name: string } | null;
};

export type NotificationPrefs = {
  workoutReminder: boolean;
  reminderTime: string | null;
  upcomingWorkout: boolean;
  goalReminder: boolean;
  prNotification: boolean;
  streakReminder: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
};
