import { z } from 'zod';

export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

const email = z.string().trim().toLowerCase().email('Invalid email address');

const confirmMatches = <T extends { password: string; confirmPassword?: string }>(d: T) =>
  d.confirmPassword === undefined || d.confirmPassword === d.password;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is too short').max(100),
    email,
    password: passwordRule,
    confirmPassword: z.string().optional(),
  })
  .refine(confirmMatches, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(10).max(200) });

export const logoutSchema = z.object({ refreshToken: z.string().max(200).optional() });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(128),
    password: passwordRule,
    confirmPassword: z.string().optional(),
  })
  .refine(confirmMatches, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const sessionIdParam = z.object({ sid: z.string().length(32) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
