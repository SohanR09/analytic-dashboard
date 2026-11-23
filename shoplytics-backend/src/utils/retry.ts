import { Prisma } from '@prisma/client';

/** MongoDB aborts a transaction on a write conflict (Prisma code P2034); the safe fix is to run it again. */
export async function retryOnConflict<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const conflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
      if (!conflict || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 25 * i));
    }
  }
}
