import type { Business } from '@prisma/client';
import type { Role } from '../constants/permissions';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate`: the verified user and the Redis session the access token belongs to. */
      user?: { id: string; sid: string };
      /** Set by `businessContext`: the business the caller is a member of. */
      business?: Business;
      /** Set by `businessContext`: the caller's role in that business. */
      membership?: { role: Role };
    }
  }
}

export {};
