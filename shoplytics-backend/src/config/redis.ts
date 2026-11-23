import Redis from 'ioredis';
import { env } from './env';

/**
 * Shared Redis client. Used for:
 *   - sessions (refresh-token rotation, instant revocation)   -> services/session.service.ts
 *   - rate limiting + login lockout                             -> services/ratelimit.service.ts
 *   - password-reset tokens                                     -> services/auth.service.ts
 *   - analytics cache                                           -> services/cache.service.ts
 *
 * Every key is namespaced with the `shoplytics:` prefix (applied by ioredis, including Lua KEYS).
 *
 * Redis is OPTIONAL at runtime: when it is unreachable the app keeps running on an in-memory fallback
 * (config/memoryStore.ts) and logs a warning periodically until Redis comes back. ioredis keeps reconnecting
 * in the background; `enableOfflineQueue: false` makes commands fail fast instead of hanging requests.
 */
export const redis = new Redis(env.REDIS_URL, {
  keyPrefix: 'shoplytics:',
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  retryStrategy: (times) => Math.min(times * 200, 5000),
});

/** True when Redis is connected and accepting commands. Callers use the in-memory fallback otherwise. */
export const isRedisReady = (): boolean => redis.status === 'ready';

/** Hides the password in redis://user:password@host URLs before logging. */
const redactUrl = (url: string) => url.replace(/\/\/([^:@/]*):[^@/]*@/, '//$1:***@');

const UNAVAILABLE_LOG_INTERVAL_MS = 30_000;
let lastError = '';
let wasReady = false;
let warnTimer: NodeJS.Timeout | undefined;

function warnUnavailable() {
  console.warn(
    `[redis] Redis is not available (${redactUrl(env.REDIS_URL)}${lastError ? `: ${lastError}` : ''}). ` +
      'Running with in-memory fallback - sessions, rate limits and reset tokens are per-process and lost on restart.',
  );
}

redis.on('error', (err) => {
  lastError = err.message || (err as NodeJS.ErrnoException).code || 'connection error';
});

redis.on('ready', () => {
  console.log(wasReady ? '[redis] Redis reconnected' : 'Redis connected');
  wasReady = true;
});

redis.on('end', () => {
  if (warnTimer) clearInterval(warnTimer);
});

export async function connectRedis(): Promise<void> {
  if (redis.status === 'wait' || redis.status === 'end') {
    // Never block or crash startup on Redis: ioredis keeps retrying in the background.
    await Promise.race([redis.connect(), new Promise((r) => setTimeout(r, 3000))]).catch(() => undefined);
  }
  if (!isRedisReady()) {
    // With several API containers (or after a restart) the in-memory fallback silently splits / loses sessions
    // and rate limits, so production refuses to start without Redis; the orchestrator retries the container.
    if (env.redisRequired) {
      throw new Error(`Redis is required (REDIS_REQUIRED) but not reachable at ${redactUrl(env.REDIS_URL)}${lastError ? `: ${lastError}` : ''}`);
    }
    warnUnavailable();
  }

  if (!warnTimer) {
    warnTimer = setInterval(() => {
      if (!isRedisReady()) warnUnavailable();
    }, UNAVAILABLE_LOG_INTERVAL_MS);
    warnTimer.unref();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (warnTimer) clearInterval(warnTimer);
  warnTimer = undefined;
  if (redis.status !== 'end') {
    if (isRedisReady()) await redis.quit().catch(() => redis.disconnect());
    else redis.disconnect();
  }
}
