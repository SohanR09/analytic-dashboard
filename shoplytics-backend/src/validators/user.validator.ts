import { z } from 'zod';
import { passwordRule } from './auth.validator';
import { urlOrEmpty } from './common';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    /** Required only when changing the email address. */
    currentPassword: z.string().min(1).optional(),
    profileImage: urlOrEmpty.optional(),
    preferences: z.record(z.unknown()).optional(),
  })
  .refine((d) => !d.email || !!d.currentPassword, {
    message: 'Current password is required to change your email',
    path: ['currentPassword'],
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordRule,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
