import { Difficulty, FitnessGoal } from '../../../src/generated/prisma/enums.js';

/**
 * Optional starting points only.
 *
 * A template is copied into a normal, fully editable WorkoutPlan - nothing
 * about it is locked afterwards. Exercises and muscle groups are referenced by
 * slug so templates keep resolving as the library grows, and any slug that
 * cannot be found is simply skipped.
 *
 * `position` is the 0-based offset from the user's week start (0 = Monday for
 * the default Monday-start week).
 */
type TemplateExercise = { slug: string; muscleGroup?: string; sets?: number; repsMin?: number; repsMax?: number };
type TemplateDay = {
  position: number;
  label?: string;
  rest?: boolean;
  muscleGroups?: string[];
  exercises?: TemplateExercise[];
};

export const planTemplates: Array<{
  slug: string;
  name: string;
  description: string;
  goal: FitnessGoal;
  difficulty: Difficulty;
  daysPerWeek: number;
  cycleLength: number;
  sortOrder: number;
  structure: TemplateDay[];
}> = [
  {
    slug: 'push-pull-legs',
    name: 'Push / Pull / Legs',
    description:
      'Six training days split by movement pattern. The most popular hypertrophy split for a reason - plenty of volume per muscle group with built-in recovery.',
    goal: FitnessGoal.BUILD_MUSCLE,
    difficulty: Difficulty.INTERMEDIATE,
    daysPerWeek: 6,
    cycleLength: 7,
    sortOrder: 1,
    structure: [
      {
        position: 0,
        label: 'Push',
        muscleGroups: ['chest', 'shoulders', 'triceps'],
        exercises: [
          { slug: 'barbell-bench-press', muscleGroup: 'chest', sets: 4, repsMin: 6, repsMax: 8 },
          { slug: 'incline-dumbbell-press', muscleGroup: 'chest', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'overhead-press', muscleGroup: 'shoulders', sets: 3, repsMin: 6, repsMax: 10 },
          { slug: 'lateral-raise', muscleGroup: 'shoulders', sets: 3, repsMin: 12, repsMax: 15 },
          { slug: 'rope-pushdown', muscleGroup: 'triceps', sets: 3, repsMin: 10, repsMax: 15 },
          { slug: 'overhead-triceps-extension', muscleGroup: 'triceps', sets: 3, repsMin: 10, repsMax: 15 },
        ],
      },
      {
        position: 1,
        label: 'Pull',
        muscleGroups: ['back', 'biceps'],
        exercises: [
          { slug: 'pull-up', muscleGroup: 'back', sets: 4, repsMin: 6, repsMax: 10 },
          { slug: 'barbell-row', muscleGroup: 'back', sets: 4, repsMin: 6, repsMax: 10 },
          { slug: 'seated-cable-row', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'face-pull', muscleGroup: 'back', sets: 3, repsMin: 12, repsMax: 15 },
          { slug: 'barbell-curl', muscleGroup: 'biceps', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'hammer-curl', muscleGroup: 'biceps', sets: 3, repsMin: 10, repsMax: 12 },
        ],
      },
      {
        position: 2,
        label: 'Legs',
        muscleGroups: ['legs', 'glutes', 'calves'],
        exercises: [
          { slug: 'back-squat', muscleGroup: 'legs', sets: 4, repsMin: 5, repsMax: 8 },
          { slug: 'romanian-deadlift', muscleGroup: 'legs', sets: 3, repsMin: 8, repsMax: 10 },
          { slug: 'leg-press', muscleGroup: 'legs', sets: 3, repsMin: 10, repsMax: 15 },
          { slug: 'lying-leg-curl', muscleGroup: 'legs', sets: 3, repsMin: 10, repsMax: 15 },
          { slug: 'standing-calf-raise', muscleGroup: 'calves', sets: 4, repsMin: 12, repsMax: 20 },
        ],
      },
      {
        position: 3,
        label: 'Push',
        muscleGroups: ['chest', 'shoulders', 'triceps'],
        exercises: [
          { slug: 'incline-barbell-bench-press', muscleGroup: 'chest', sets: 4, repsMin: 6, repsMax: 10 },
          { slug: 'dumbbell-bench-press', muscleGroup: 'chest', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'cable-fly', muscleGroup: 'chest', sets: 3, repsMin: 12, repsMax: 15 },
          { slug: 'dumbbell-shoulder-press', muscleGroup: 'shoulders', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'cable-lateral-raise', muscleGroup: 'shoulders', sets: 3, repsMin: 12, repsMax: 20 },
          { slug: 'skull-crusher', muscleGroup: 'triceps', sets: 3, repsMin: 8, repsMax: 12 },
        ],
      },
      {
        position: 4,
        label: 'Pull',
        muscleGroups: ['back', 'biceps'],
        exercises: [
          { slug: 'deadlift', muscleGroup: 'back', sets: 3, repsMin: 3, repsMax: 5 },
          { slug: 'lat-pulldown', muscleGroup: 'back', sets: 4, repsMin: 8, repsMax: 12 },
          { slug: 'one-arm-dumbbell-row', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'rear-delt-fly', muscleGroup: 'back', sets: 3, repsMin: 12, repsMax: 20 },
          { slug: 'incline-dumbbell-curl', muscleGroup: 'biceps', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'barbell-shrug', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 15 },
        ],
      },
      {
        position: 5,
        label: 'Legs & Core',
        muscleGroups: ['legs', 'glutes', 'abs'],
        exercises: [
          { slug: 'front-squat', muscleGroup: 'legs', sets: 4, repsMin: 6, repsMax: 8 },
          { slug: 'hip-thrust', muscleGroup: 'glutes', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'bulgarian-split-squat', muscleGroup: 'legs', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'seated-calf-raise', muscleGroup: 'calves', sets: 4, repsMin: 15, repsMax: 20 },
          { slug: 'hanging-leg-raise', muscleGroup: 'abs', sets: 3, repsMin: 8, repsMax: 15 },
          { slug: 'cable-crunch', muscleGroup: 'abs', sets: 3, repsMin: 12, repsMax: 15 },
        ],
      },
      { position: 6, label: 'Rest', rest: true },
    ],
  },
  {
    slug: 'upper-lower',
    name: 'Upper / Lower',
    description:
      'Four days a week, alternating upper and lower body. A great balance of frequency and recovery if six days is too much.',
    goal: FitnessGoal.BUILD_MUSCLE,
    difficulty: Difficulty.BEGINNER,
    daysPerWeek: 4,
    cycleLength: 7,
    sortOrder: 2,
    structure: [
      {
        position: 0,
        label: 'Upper',
        muscleGroups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
        exercises: [
          { slug: 'barbell-bench-press', muscleGroup: 'chest', sets: 4, repsMin: 6, repsMax: 8 },
          { slug: 'barbell-row', muscleGroup: 'back', sets: 4, repsMin: 6, repsMax: 10 },
          { slug: 'overhead-press', muscleGroup: 'shoulders', sets: 3, repsMin: 8, repsMax: 10 },
          { slug: 'lat-pulldown', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'barbell-curl', muscleGroup: 'biceps', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'rope-pushdown', muscleGroup: 'triceps', sets: 3, repsMin: 10, repsMax: 15 },
        ],
      },
      {
        position: 1,
        label: 'Lower',
        muscleGroups: ['legs', 'glutes', 'calves', 'abs'],
        exercises: [
          { slug: 'back-squat', muscleGroup: 'legs', sets: 4, repsMin: 5, repsMax: 8 },
          { slug: 'romanian-deadlift', muscleGroup: 'legs', sets: 3, repsMin: 8, repsMax: 10 },
          { slug: 'leg-press', muscleGroup: 'legs', sets: 3, repsMin: 10, repsMax: 15 },
          { slug: 'standing-calf-raise', muscleGroup: 'calves', sets: 4, repsMin: 12, repsMax: 20 },
          { slug: 'plank', muscleGroup: 'abs', sets: 3 },
        ],
      },
      { position: 2, label: 'Rest', rest: true },
      {
        position: 3,
        label: 'Upper',
        muscleGroups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
        exercises: [
          { slug: 'incline-dumbbell-press', muscleGroup: 'chest', sets: 4, repsMin: 8, repsMax: 12 },
          { slug: 'pull-up', muscleGroup: 'back', sets: 4, repsMin: 6, repsMax: 10 },
          { slug: 'dumbbell-shoulder-press', muscleGroup: 'shoulders', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'seated-cable-row', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'lateral-raise', muscleGroup: 'shoulders', sets: 3, repsMin: 12, repsMax: 20 },
          { slug: 'hammer-curl', muscleGroup: 'biceps', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'skull-crusher', muscleGroup: 'triceps', sets: 3, repsMin: 8, repsMax: 12 },
        ],
      },
      {
        position: 4,
        label: 'Lower',
        muscleGroups: ['legs', 'glutes', 'calves', 'abs'],
        exercises: [
          { slug: 'deadlift', muscleGroup: 'legs', sets: 3, repsMin: 3, repsMax: 5 },
          { slug: 'bulgarian-split-squat', muscleGroup: 'legs', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'lying-leg-curl', muscleGroup: 'legs', sets: 3, repsMin: 10, repsMax: 15 },
          { slug: 'hip-thrust', muscleGroup: 'glutes', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'seated-calf-raise', muscleGroup: 'calves', sets: 4, repsMin: 15, repsMax: 20 },
          { slug: 'hanging-leg-raise', muscleGroup: 'abs', sets: 3, repsMin: 8, repsMax: 15 },
        ],
      },
      { position: 5, label: 'Rest', rest: true },
      { position: 6, label: 'Rest', rest: true },
    ],
  },
  {
    slug: 'full-body-3-day',
    name: 'Full Body (3 Day)',
    description:
      'Three full-body sessions a week built around the main compound lifts. The most efficient way to start if you are new to training.',
    goal: FitnessGoal.GENERAL_FITNESS,
    difficulty: Difficulty.BEGINNER,
    daysPerWeek: 3,
    cycleLength: 7,
    sortOrder: 3,
    structure: [
      {
        position: 0,
        label: 'Full Body A',
        muscleGroups: ['full-body'],
        exercises: [
          { slug: 'back-squat', sets: 3, repsMin: 5, repsMax: 8 },
          { slug: 'barbell-bench-press', sets: 3, repsMin: 5, repsMax: 8 },
          { slug: 'barbell-row', sets: 3, repsMin: 6, repsMax: 10 },
          { slug: 'plank', sets: 3 },
        ],
      },
      { position: 1, label: 'Rest', rest: true },
      {
        position: 2,
        label: 'Full Body B',
        muscleGroups: ['full-body'],
        exercises: [
          { slug: 'romanian-deadlift', sets: 3, repsMin: 6, repsMax: 10 },
          { slug: 'overhead-press', sets: 3, repsMin: 6, repsMax: 10 },
          { slug: 'lat-pulldown', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'standing-calf-raise', sets: 3, repsMin: 12, repsMax: 20 },
        ],
      },
      { position: 3, label: 'Rest', rest: true },
      {
        position: 4,
        label: 'Full Body C',
        muscleGroups: ['full-body'],
        exercises: [
          { slug: 'deadlift', sets: 3, repsMin: 3, repsMax: 5 },
          { slug: 'incline-dumbbell-press', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'seated-cable-row', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'barbell-curl', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'rope-pushdown', sets: 3, repsMin: 10, repsMax: 15 },
        ],
      },
      { position: 5, label: 'Rest', rest: true },
      { position: 6, label: 'Rest', rest: true },
    ],
  },
  {
    slug: 'classic-bro-split',
    name: 'Classic 5 Day Split',
    description:
      'One muscle group focus per day, five days a week. High volume per session and easy to follow.',
    goal: FitnessGoal.BUILD_MUSCLE,
    difficulty: Difficulty.INTERMEDIATE,
    daysPerWeek: 5,
    cycleLength: 7,
    sortOrder: 4,
    structure: [
      {
        position: 0,
        label: 'Chest & Triceps',
        muscleGroups: ['chest', 'triceps'],
        exercises: [
          { slug: 'barbell-bench-press', muscleGroup: 'chest', sets: 4, repsMin: 6, repsMax: 10 },
          { slug: 'incline-dumbbell-press', muscleGroup: 'chest', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'cable-fly', muscleGroup: 'chest', sets: 3, repsMin: 12, repsMax: 15 },
          { slug: 'pec-deck', muscleGroup: 'chest', sets: 3, repsMin: 12, repsMax: 15 },
          { slug: 'rope-pushdown', muscleGroup: 'triceps', sets: 3, repsMin: 10, repsMax: 15 },
          { slug: 'skull-crusher', muscleGroup: 'triceps', sets: 3, repsMin: 8, repsMax: 12 },
        ],
      },
      {
        position: 1,
        label: 'Back & Biceps',
        muscleGroups: ['back', 'biceps'],
        exercises: [
          { slug: 'pull-up', muscleGroup: 'back', sets: 4, repsMin: 6, repsMax: 10 },
          { slug: 'barbell-row', muscleGroup: 'back', sets: 4, repsMin: 6, repsMax: 10 },
          { slug: 'lat-pulldown', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'seated-cable-row', muscleGroup: 'back', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'barbell-curl', muscleGroup: 'biceps', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'hammer-curl', muscleGroup: 'biceps', sets: 3, repsMin: 10, repsMax: 12 },
        ],
      },
      {
        position: 2,
        label: 'Shoulders',
        muscleGroups: ['shoulders'],
        exercises: [
          { slug: 'overhead-press', muscleGroup: 'shoulders', sets: 4, repsMin: 6, repsMax: 10 },
          { slug: 'dumbbell-shoulder-press', muscleGroup: 'shoulders', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'lateral-raise', muscleGroup: 'shoulders', sets: 4, repsMin: 12, repsMax: 20 },
          { slug: 'rear-delt-fly', muscleGroup: 'shoulders', sets: 3, repsMin: 12, repsMax: 20 },
          { slug: 'face-pull', muscleGroup: 'shoulders', sets: 3, repsMin: 12, repsMax: 15 },
          { slug: 'barbell-shrug', muscleGroup: 'shoulders', sets: 3, repsMin: 10, repsMax: 15 },
        ],
      },
      {
        position: 3,
        label: 'Legs',
        muscleGroups: ['legs', 'glutes', 'calves'],
        exercises: [
          { slug: 'back-squat', muscleGroup: 'legs', sets: 4, repsMin: 5, repsMax: 8 },
          { slug: 'romanian-deadlift', muscleGroup: 'legs', sets: 3, repsMin: 8, repsMax: 10 },
          { slug: 'leg-press', muscleGroup: 'legs', sets: 3, repsMin: 10, repsMax: 15 },
          { slug: 'leg-extension', muscleGroup: 'legs', sets: 3, repsMin: 12, repsMax: 15 },
          { slug: 'lying-leg-curl', muscleGroup: 'legs', sets: 3, repsMin: 10, repsMax: 15 },
          { slug: 'standing-calf-raise', muscleGroup: 'calves', sets: 4, repsMin: 12, repsMax: 20 },
        ],
      },
      {
        position: 4,
        label: 'Arms & Abs',
        muscleGroups: ['biceps', 'triceps', 'abs'],
        exercises: [
          { slug: 'ez-bar-curl', muscleGroup: 'biceps', sets: 4, repsMin: 8, repsMax: 12 },
          { slug: 'incline-dumbbell-curl', muscleGroup: 'biceps', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'close-grip-bench-press', muscleGroup: 'triceps', sets: 4, repsMin: 8, repsMax: 10 },
          { slug: 'overhead-triceps-extension', muscleGroup: 'triceps', sets: 3, repsMin: 10, repsMax: 15 },
          { slug: 'hanging-leg-raise', muscleGroup: 'abs', sets: 3, repsMin: 8, repsMax: 15 },
          { slug: 'cable-crunch', muscleGroup: 'abs', sets: 3, repsMin: 12, repsMax: 15 },
        ],
      },
      { position: 5, label: 'Rest', rest: true },
      { position: 6, label: 'Rest', rest: true },
    ],
  },
  {
    slug: 'strength-5-3-1',
    name: 'Strength Focus (4 Day)',
    description:
      'Four days built around heavy squat, bench, deadlift and press work, with just enough accessory volume to support it.',
    goal: FitnessGoal.STRENGTH,
    difficulty: Difficulty.ADVANCED,
    daysPerWeek: 4,
    cycleLength: 7,
    sortOrder: 5,
    structure: [
      {
        position: 0,
        label: 'Squat',
        muscleGroups: ['legs', 'abs'],
        exercises: [
          { slug: 'back-squat', muscleGroup: 'legs', sets: 5, repsMin: 3, repsMax: 5 },
          { slug: 'front-squat', muscleGroup: 'legs', sets: 3, repsMin: 5, repsMax: 8 },
          { slug: 'leg-press', muscleGroup: 'legs', sets: 3, repsMin: 10, repsMax: 12 },
          { slug: 'hanging-leg-raise', muscleGroup: 'abs', sets: 3, repsMin: 8, repsMax: 12 },
        ],
      },
      {
        position: 1,
        label: 'Bench',
        muscleGroups: ['chest', 'triceps'],
        exercises: [
          { slug: 'barbell-bench-press', muscleGroup: 'chest', sets: 5, repsMin: 3, repsMax: 5 },
          { slug: 'close-grip-bench-press', muscleGroup: 'triceps', sets: 3, repsMin: 6, repsMax: 8 },
          { slug: 'dumbbell-bench-press', muscleGroup: 'chest', sets: 3, repsMin: 8, repsMax: 12 },
          { slug: 'rope-pushdown', muscleGroup: 'triceps', sets: 3, repsMin: 10, repsMax: 15 },
        ],
      },
      { position: 2, label: 'Rest', rest: true },
      {
        position: 3,
        label: 'Deadlift',
        muscleGroups: ['back', 'legs'],
        exercises: [
          { slug: 'deadlift', muscleGroup: 'back', sets: 5, repsMin: 1, repsMax: 5 },
          { slug: 'romanian-deadlift', muscleGroup: 'legs', sets: 3, repsMin: 6, repsMax: 10 },
          { slug: 'barbell-row', muscleGroup: 'back', sets: 4, repsMin: 6, repsMax: 8 },
          { slug: 'pull-up', muscleGroup: 'back', sets: 3, repsMin: 6, repsMax: 10 },
        ],
      },
      {
        position: 4,
        label: 'Press',
        muscleGroups: ['shoulders', 'back'],
        exercises: [
          { slug: 'overhead-press', muscleGroup: 'shoulders', sets: 5, repsMin: 3, repsMax: 5 },
          { slug: 'incline-barbell-bench-press', muscleGroup: 'shoulders', sets: 3, repsMin: 6, repsMax: 8 },
          { slug: 'lateral-raise', muscleGroup: 'shoulders', sets: 3, repsMin: 12, repsMax: 20 },
          { slug: 'face-pull', muscleGroup: 'back', sets: 3, repsMin: 12, repsMax: 15 },
        ],
      },
      { position: 5, label: 'Rest', rest: true },
      { position: 6, label: 'Rest', rest: true },
    ],
  },
];
