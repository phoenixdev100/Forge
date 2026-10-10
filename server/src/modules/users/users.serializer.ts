import type { UserModel } from '../../generated/prisma/models.js';
import { dateOnly, iso, num } from '../../lib/serialize.js';

/** The canonical shape of "me" across auth, profile and settings responses. */
export function serializeUser(user: UserModel) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    unit: user.unit,
    goal: user.goal,
    experience: user.experience,
    trainingDaysPerWeek: user.trainingDaysPerWeek,
    heightCm: num(user.heightCm),
    bodyWeightKg: num(user.bodyWeightKg),
    dateOfBirth: dateOnly(user.dateOfBirth),
    sex: user.sex,
    timezone: user.timezone,
    weekStartsOn: user.weekStartsOn,
    onboardedAt: iso(user.onboardedAt),
    createdAt: iso(user.createdAt),
  };
}

export type SerializedUser = ReturnType<typeof serializeUser>;
