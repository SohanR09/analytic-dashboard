import { Router } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { isRedisReady, redis } from '../config/redis';
import { ok } from '../utils/response';
import authRoutes from './auth.routes';
import businessRoutes from './business.routes';
import userRoutes from './user.routes';

const router = Router();

/** Liveness: the process is up. */
router.get('/health', (_req, res) => ok(res, { status: 'ok', uptime: Math.round(process.uptime()) }));

/**
 * Readiness: MongoDB must be reachable. Redis is required when REDIS_REQUIRED (default in production);
 * otherwise "down" just means the in-memory fallback is in use.
 */
router.get('/health/ready', async (_req, res) => {
  const check = async (fn: () => Promise<unknown>) => fn().then(() => 'up', () => 'down');
  const [mongo, cache] = await Promise.all([
    check(() => prisma.$runCommandRaw({ ping: 1 })),
    isRedisReady() ? check(() => redis.ping()) : Promise.resolve('down'),
  ]);
  const healthy = mongo === 'up' && (cache === 'up' || !env.redisRequired);
  res.status(healthy ? 200 : 503).json({ success: healthy, data: { mongodb: mongo, redis: cache } });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/businesses', businessRoutes);

export default router;
