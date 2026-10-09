import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(255);

/**
 * Deliberately pragmatic: length is the dominant factor in password strength,
 * and arbitrary symbol rules push people toward `Password1!`.
 */
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'That password is too long.')
  .refine((v) => /[a-zA-Z]/.test(v), 'Include at least one letter.')
  .refine((v) => /[0-9]/.test(v) || /[^a-zA-Z0-9]/.test(v), 'Include at least one number or symbol.');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Tell us your name.').max(80),
  email,
  password,
  timezone: z.string().max(64).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'This reset link is not valid.'),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
