import { BodyRegion } from '../../../src/generated/prisma/enums.js';

export type MuscleGroupSeed = {
  slug: string;
  name: string;
  bodyRegion: BodyRegion;
  colorHex: string;
  parent?: string;
};

/**
 * A tree, not a flat list. Top-level groups are what people actually say out
 * loud ("Chest + Triceps"); children let the library target finer areas
 * (Rear Delts, Lats) without inventing new top-level groups. Adding more is
 * pure data - no code change required.
 */
export const muscleGroups: MuscleGroupSeed[] = [
  { slug: 'chest', name: 'Chest', bodyRegion: BodyRegion.UPPER, colorHex: '#ef4444' },
  { slug: 'upper-chest', name: 'Upper Chest', bodyRegion: BodyRegion.UPPER, colorHex: '#f87171', parent: 'chest' },
  { slug: 'lower-chest', name: 'Lower Chest', bodyRegion: BodyRegion.UPPER, colorHex: '#fca5a5', parent: 'chest' },

  { slug: 'back', name: 'Back', bodyRegion: BodyRegion.UPPER, colorHex: '#3b82f6' },
  { slug: 'lats', name: 'Lats', bodyRegion: BodyRegion.UPPER, colorHex: '#60a5fa', parent: 'back' },
  { slug: 'upper-back', name: 'Upper Back', bodyRegion: BodyRegion.UPPER, colorHex: '#93c5fd', parent: 'back' },
  { slug: 'lower-back', name: 'Lower Back', bodyRegion: BodyRegion.CORE, colorHex: '#1d4ed8', parent: 'back' },

  { slug: 'shoulders', name: 'Shoulders', bodyRegion: BodyRegion.UPPER, colorHex: '#f59e0b' },
  { slug: 'front-delts', name: 'Front Delts', bodyRegion: BodyRegion.UPPER, colorHex: '#fbbf24', parent: 'shoulders' },
  { slug: 'side-delts', name: 'Side Delts', bodyRegion: BodyRegion.UPPER, colorHex: '#fcd34d', parent: 'shoulders' },
  { slug: 'rear-delts', name: 'Rear Delts', bodyRegion: BodyRegion.UPPER, colorHex: '#d97706', parent: 'shoulders' },

  { slug: 'traps', name: 'Traps', bodyRegion: BodyRegion.UPPER, colorHex: '#6366f1' },
  { slug: 'neck', name: 'Neck', bodyRegion: BodyRegion.UPPER, colorHex: '#818cf8' },

  { slug: 'biceps', name: 'Biceps', bodyRegion: BodyRegion.UPPER, colorHex: '#8b5cf6' },
  { slug: 'triceps', name: 'Triceps', bodyRegion: BodyRegion.UPPER, colorHex: '#a855f7' },
  { slug: 'forearms', name: 'Forearms', bodyRegion: BodyRegion.UPPER, colorHex: '#c084fc' },

  { slug: 'legs', name: 'Legs', bodyRegion: BodyRegion.LOWER, colorHex: '#10b981' },
  { slug: 'quads', name: 'Quads', bodyRegion: BodyRegion.LOWER, colorHex: '#34d399', parent: 'legs' },
  { slug: 'hamstrings', name: 'Hamstrings', bodyRegion: BodyRegion.LOWER, colorHex: '#059669', parent: 'legs' },
  { slug: 'adductors', name: 'Adductors', bodyRegion: BodyRegion.LOWER, colorHex: '#6ee7b7', parent: 'legs' },
  { slug: 'abductors', name: 'Abductors', bodyRegion: BodyRegion.LOWER, colorHex: '#a7f3d0', parent: 'legs' },
  { slug: 'hip-flexors', name: 'Hip Flexors', bodyRegion: BodyRegion.LOWER, colorHex: '#2dd4bf', parent: 'legs' },

  { slug: 'glutes', name: 'Glutes', bodyRegion: BodyRegion.LOWER, colorHex: '#ec4899' },
  { slug: 'calves', name: 'Calves', bodyRegion: BodyRegion.LOWER, colorHex: '#14b8a6' },

  { slug: 'abs', name: 'Abs & Core', bodyRegion: BodyRegion.CORE, colorHex: '#eab308' },
  { slug: 'obliques', name: 'Obliques', bodyRegion: BodyRegion.CORE, colorHex: '#facc15', parent: 'abs' },

  { slug: 'full-body', name: 'Full Body', bodyRegion: BodyRegion.FULL_BODY, colorHex: '#64748b' },
  { slug: 'cardio', name: 'Cardio', bodyRegion: BodyRegion.FULL_BODY, colorHex: '#0ea5e9' },
];

export const equipment: Array<{ slug: string; name: string; iconKey: string }> = [
  { slug: 'barbell', name: 'Barbell', iconKey: 'barbell' },
  { slug: 'dumbbell', name: 'Dumbbell', iconKey: 'dumbbell' },
  { slug: 'cable', name: 'Cable', iconKey: 'cable' },
  { slug: 'machine', name: 'Machine', iconKey: 'machine' },
  { slug: 'bodyweight', name: 'Bodyweight', iconKey: 'bodyweight' },
  { slug: 'kettlebell', name: 'Kettlebell', iconKey: 'kettlebell' },
  { slug: 'resistance-band', name: 'Resistance Band', iconKey: 'band' },
  { slug: 'smith-machine', name: 'Smith Machine', iconKey: 'machine' },
  { slug: 'ez-bar', name: 'EZ Bar', iconKey: 'barbell' },
  { slug: 'trap-bar', name: 'Trap Bar', iconKey: 'barbell' },
  { slug: 'bench', name: 'Bench', iconKey: 'bench' },
  { slug: 'medicine-ball', name: 'Medicine Ball', iconKey: 'ball' },
  { slug: 'exercise-ball', name: 'Exercise Ball', iconKey: 'ball' },
  { slug: 'foam-roller', name: 'Foam Roller', iconKey: 'roller' },
  { slug: 'suspension-trainer', name: 'Suspension Trainer', iconKey: 'band' },
  { slug: 'sled', name: 'Sled', iconKey: 'sled' },
  { slug: 'cardio-machine', name: 'Cardio Machine', iconKey: 'cardio' },
  { slug: 'other', name: 'Other', iconKey: 'other' },
];

export const categories: Array<{ slug: string; name: string; description: string }> = [
  { slug: 'strength', name: 'Strength', description: 'Classic resistance training for muscle and strength.' },
  { slug: 'powerlifting', name: 'Powerlifting', description: 'Squat, bench and deadlift focused heavy work.' },
  { slug: 'olympic-weightlifting', name: 'Olympic Weightlifting', description: 'Snatch, clean and jerk and their variations.' },
  { slug: 'plyometrics', name: 'Plyometrics', description: 'Explosive jumping and throwing movements.' },
  { slug: 'strongman', name: 'Strongman', description: 'Carries, drags and odd-object lifting.' },
  { slug: 'cardio', name: 'Cardio', description: 'Conditioning and endurance work.' },
  { slug: 'stretching', name: 'Stretching', description: 'Static and dynamic flexibility work.' },
  { slug: 'mobility', name: 'Mobility', description: 'Joint range-of-motion and movement prep.' },
  { slug: 'functional', name: 'Functional', description: 'Carryover movements for everyday strength.' },
];

/** Maps the free-exercise-db vocabularies onto the seeded taxonomy above. */
export const datasetMuscleMap: Record<string, string> = {
  abdominals: 'abs',
  abductors: 'abductors',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'lats',
  'lower back': 'lower-back',
  'middle back': 'upper-back',
  neck: 'neck',
  quadriceps: 'quads',
  shoulders: 'shoulders',
  traps: 'traps',
  triceps: 'triceps',
};

export const datasetEquipmentMap: Record<string, string> = {
  bands: 'resistance-band',
  barbell: 'barbell',
  'body only': 'bodyweight',
  cable: 'cable',
  dumbbell: 'dumbbell',
  'e-z curl bar': 'ez-bar',
  'exercise ball': 'exercise-ball',
  'foam roll': 'foam-roller',
  kettlebells: 'kettlebell',
  machine: 'machine',
  'medicine ball': 'medicine-ball',
  other: 'other',
};

export const datasetCategoryMap: Record<string, string> = {
  cardio: 'cardio',
  'olympic weightlifting': 'olympic-weightlifting',
  plyometrics: 'plyometrics',
  powerlifting: 'powerlifting',
  strength: 'strength',
  stretching: 'stretching',
  strongman: 'strongman',
};
