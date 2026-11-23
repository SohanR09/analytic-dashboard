import { PrismaClient } from '@prisma/client';
import { env } from './env';

/** Single shared Prisma client (ORM layer over MongoDB). */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDB(): Promise<void> {
  await prisma.$connect();
  console.log('MongoDB connected (Prisma)');
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}
