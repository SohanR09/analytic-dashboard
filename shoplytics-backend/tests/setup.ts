import { afterAll, beforeAll } from 'vitest';

// Must be set before any app module is imported (config/env.ts validates process.env on import).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'mongodb://127.0.0.1:27017/shoplytics_test?replicaSet=rs0';
process.env.REDIS_URL ||= 'redis://127.0.0.1:6390';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.LOGIN_MAX_FAILURES = '3';
process.env.RATE_LIMIT_ENABLED = 'true';

beforeAll(async () => {
  const { connectRedis, redis } = await import('../src/config/redis');
  await connectRedis();
  await redis.flushdb();
});

afterAll(async () => {
  const { disconnectRedis } = await import('../src/config/redis');
  await disconnectRedis();
});
