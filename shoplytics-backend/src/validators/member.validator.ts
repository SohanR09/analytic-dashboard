import { z } from 'zod';
import { ASSIGNABLE_ROLES } from '../constants/permissions';
import { objectId } from './common';

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ASSIGNABLE_ROLES),
});

export const updateMemberSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) });

export const memberParam = z.object({ userId: objectId });

export type AddMemberInput = z.infer<typeof addMemberSchema>;
