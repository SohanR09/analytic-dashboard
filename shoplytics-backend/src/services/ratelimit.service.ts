import { memoryStore as mem } from '../config/memoryStore';
import { isRedisReady, redis } from '../config/redis';

/**
 * Rate limiting strategy: sliding-window COUNTER in Redis (one atomic Lua call per request)
 * ----------------------------------------------------------------------------------------
 * Estimated requests in the last `window` = hits(current window) + hits(previous window) * (fraction of
 * the previous window still overlapping). Compared with a fixed window this removes the "2x burst at the
 * window boundary" problem, and unlike a sliding LOG it needs only two counters per client (O(1) memory).
 * Redis server time is used, so multiple API instances never disagree because of clock skew.
 * Rejected requests are not counted, so a throttled client recovers as soon as the estimate drops.
 *
 * While Redis is unavailable the same algorithm runs against the in-process memory store (per instance).
 * Fail-OPEN: if a Redis call errors the request is allowed (availability over strictness).
 */

interface SlidingWindowCommand {
  slidingWindow(key: string, limit: number, windowMs: number): Promise<[number, number, number]>;
}

redis.defineCommand('slidingWindow', {
  numberOfKeys: 1,
  lua: `
    local limit = tonumber(ARGV[1])
    local windowMs = tonumber(ARGV[2])
    local t = redis.call('TIME')
    local nowMs = t[1] * 1000 + math.floor(t[2] / 1000)
    local idx = math.floor(nowMs / windowMs)
    local cur = KEYS[1] .. ':' .. idx
    local prev = KEYS[1] .. ':' .. (idx - 1)
    local count = redis.call('INCR', cur)
    if count == 1 then redis.call('PEXPIRE', cur, windowMs * 2) end
    local prevCount = tonumber(redis.call('GET', prev) or '0')
    local elapsed = nowMs - idx * windowMs
    local est = count + prevCount * ((windowMs - elapsed) / windowMs)
    local resetMs = windowMs - elapsed
    if est > limit then
      redis.call('DECR', cur)
      return {0, 0, resetMs}
    end
    return {1, math.max(0, math.floor(limit - est)), resetMs}
  `,
});

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window rolls over (use as Retry-After when blocked). */
  resetSeconds: number;
}

/** In-memory twin of the Lua script above (single process, so it is atomic by construction). */
function consumeInMemory(key: string, limit: number, windowSec: number): RateLimitResult {
  const windowMs = windowSec * 1000;
  const nowMs = Date.now();
  const idx = Math.floor(nowMs / windowMs);
  const cur = `rl-mem:${key}:${idx}`;
  const count = mem.incr(cur);
  if (count === 1) mem.expireMs(cur, windowMs * 2);
  const prevCount = Number(mem.get(`rl-mem:${key}:${idx - 1}`) ?? 0);
  const elapsed = nowMs - idx * windowMs;
  const est = count + prevCount * ((windowMs - elapsed) / windowMs);
  const resetSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
  if (est > limit) {
    mem.decr(cur);
    return { allowed: false, limit, remaining: 0, resetSeconds };
  }
  return { allowed: true, limit, remaining: Math.max(0, Math.floor(limit - est)), resetSeconds };
}

export async function consume(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  if (!isRedisReady()) return consumeInMemory(key, limit, windowSec);
  try {
    const [allowed, remaining, resetMs] = await (redis as unknown as SlidingWindowCommand).slidingWindow(
      key,
      limit,
      windowSec * 1000,
    );
    return { allowed: allowed === 1, limit, remaining, resetSeconds: Math.max(1, Math.ceil(resetMs / 1000)) };
  } catch (err) {
    console.error(`[ratelimit] Redis error, failing open: ${(err as Error).message}`);
    return { allowed: true, limit, remaining: limit, resetSeconds: windowSec };
  }
}
