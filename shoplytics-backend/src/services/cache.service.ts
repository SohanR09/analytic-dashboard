import { isRedisReady, redis } from '../config/redis';
import { sha256 } from '../utils/helpers';

/**
 * Analytics cache (Redis) with version-based invalidation.
 *
 * Every cached value is keyed by the business's current "data version". Any write that can change analytics
 * (orders, products, stock, customers, categories, business settings) calls `invalidateBusiness`, which bumps
 * the version - all older entries become unreachable at once and simply expire (short TTL). No key scanning.
 * Cache errors never break a request: on any Redis failure we just compute the value.
 */

const TTL_SECONDS = 60;
const verKey = (businessId: string) => `bver:${businessId}`;

export async function wrap<T>(businessId: string, name: string, params: unknown, fn: () => Promise<T>): Promise<T> {
  if (!isRedisReady()) return fn(); // no cache while Redis is down
  let key: string | null = null;
  try {
    const version = (await redis.get(verKey(businessId))) ?? '0';
    key = `cache:${businessId}:${version}:${name}:${sha256(JSON.stringify(params ?? {})).slice(0, 24)}`;
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    key = null;
  }

  const value = await fn();

  if (key) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', TTL_SECONDS);
    } catch {
      /* ignore cache write failures */
    }
  }
  return value;
}

export async function invalidateBusiness(businessId: string): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await redis.incr(verKey(businessId));
  } catch {
    /* a failed bump only means entries live out their short TTL */
  }
}
