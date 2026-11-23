import { z } from 'zod';

export const passwordRule = z.string().min(8, 'At least 8 characters').max(128)
  .regex(/[A-Za-z]/, 'Include at least one letter').regex(/\d/, 'Include at least one number');

export const loginSchema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Password is required'), rememberMe: z.boolean() });
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(100),
  email: z.string().trim().email('Enter a valid email'),
  password: passwordRule,
  confirmPassword: z.string(),
  terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
export const forgotSchema = z.object({ email: z.string().trim().email('Enter a valid email') });
export const resetSchema = z.object({ token: z.string().min(10, 'Paste the token from your email'), password: passwordRule, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
