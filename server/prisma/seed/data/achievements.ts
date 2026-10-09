import { AchievementCategory } from '../../../src/generated/prisma/enums.js';

/**
 * Achievements are pure data: `metric` + `threshold` are evaluated against the
 * user's rolled-up stats, so new ones can be added from the admin panel
 * without touching application code.
 *
 * Deliberately understated - milestones worth noticing, not a points economy.
 */
export const achievements = [
  { slug: 'first-workout', name: 'First Workout', description: 'You logged your first session. The hardest one is done.', metric: 'workouts', threshold: 1, category: AchievementCategory.MILESTONE, iconKey: 'flag' },
  { slug: 'workouts-10', name: '10 Workouts', description: 'Ten sessions in the books.', metric: 'workouts', threshold: 10, category: AchievementCategory.MILESTONE, iconKey: 'dumbbell' },
  { slug: 'workouts-50', name: '50 Workouts', description: 'Fifty sessions. This is a habit now.', metric: 'workouts', threshold: 50, category: AchievementCategory.MILESTONE, iconKey: 'dumbbell' },
  { slug: 'workouts-100', name: '100 Workouts', description: 'A hundred sessions logged.', metric: 'workouts', threshold: 100, category: AchievementCategory.MILESTONE, iconKey: 'trophy' },
  { slug: 'workouts-250', name: '250 Workouts', description: 'Years of consistent training, recorded.', metric: 'workouts', threshold: 250, category: AchievementCategory.MILESTONE, iconKey: 'trophy' },

  { slug: 'streak-7', name: '7 Day Streak', description: 'A full week on plan.', metric: 'streak', threshold: 7, category: AchievementCategory.CONSISTENCY, iconKey: 'flame' },
  { slug: 'streak-30', name: '30 Day Streak', description: 'A month without missing a scheduled day.', metric: 'streak', threshold: 30, category: AchievementCategory.CONSISTENCY, iconKey: 'flame' },
  { slug: 'streak-100', name: '100 Day Streak', description: 'A hundred days on plan.', metric: 'streak', threshold: 100, category: AchievementCategory.CONSISTENCY, iconKey: 'flame' },

  { slug: 'first-pr', name: 'First PR', description: 'You beat a previous best for the first time.', metric: 'prs', threshold: 1, category: AchievementCategory.STRENGTH, iconKey: 'trending-up' },
  { slug: 'prs-10', name: '10 PRs', description: 'Ten personal records broken.', metric: 'prs', threshold: 10, category: AchievementCategory.STRENGTH, iconKey: 'trending-up' },
  { slug: 'prs-50', name: '50 PRs', description: 'Fifty personal records. Consistent progression.', metric: 'prs', threshold: 50, category: AchievementCategory.STRENGTH, iconKey: 'trending-up' },

  { slug: 'sets-100', name: '100 Sets', description: 'A hundred working sets recorded.', metric: 'sets', threshold: 100, category: AchievementCategory.VOLUME, iconKey: 'layers' },
  { slug: 'sets-1000', name: '1,000 Sets', description: 'A thousand working sets.', metric: 'sets', threshold: 1000, category: AchievementCategory.VOLUME, iconKey: 'layers' },
  { slug: 'volume-10000', name: '10,000 kg Moved', description: 'Ten tonnes of total volume.', metric: 'volumeKg', threshold: 10_000, category: AchievementCategory.VOLUME, iconKey: 'weight' },
  { slug: 'volume-100000', name: '100,000 kg Moved', description: 'A hundred tonnes of total volume.', metric: 'volumeKg', threshold: 100_000, category: AchievementCategory.VOLUME, iconKey: 'weight' },
  { slug: 'volume-1000000', name: '1,000,000 kg Moved', description: 'A million kilograms. Genuinely a lot.', metric: 'volumeKg', threshold: 1_000_000, category: AchievementCategory.VOLUME, iconKey: 'weight' },

  { slug: 'exercises-25', name: '25 Exercises', description: 'You have trained 25 different movements.', metric: 'uniqueExercises', threshold: 25, category: AchievementCategory.EXPLORATION, iconKey: 'compass' },
  { slug: 'exercises-75', name: '75 Exercises', description: 'A broad training vocabulary.', metric: 'uniqueExercises', threshold: 75, category: AchievementCategory.EXPLORATION, iconKey: 'compass' },
];
