import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { memoryStore as mem } from '../config/memoryStore';
import { isRedisReady, redis } from '../config/redis';
import { ApiError } from '../utils/ApiError';
import { randomToken, sha256 } from '../utils/helpers';

/**
 * Session strategy: short-lived access JWT + server-side session in Redis
 * ------------------------------------------------------------------------
 * - Access token  : JWT (HS256, default 15 min) carrying { sub: userId, sid }.
 * - Refresh token : opaque `${sid}.${secret}`; only SHA-256(secret) is stored in Redis.
 * - Session       : Redis hash `sess:{sid}` with a sliding TTL (1 day, or 30 days with "remember me").
 *
 * Every authenticated request checks that `sess:{sid}` still exists, so logout / "log out everywhere" /
 * password change take effect IMMEDIATELY instead of waiting for the JWT to expire.
 * Refresh tokens rotate on every use; presenting an old one (token theft / replay) destroys the session.
 * If Redis is unreachable, sessions are created and checked in an in-process memory store instead
 * (config/memoryStore.ts). A session lives in exactly one store; lookups find it in memory first, then Redis.
 * If Redis drops mid-request the operation fails CLOSED (503) - we never accept unverifiable sessions.
 */

const sessKey = (sid: string) => `sess:${sid}`;
const userKey = (userId: string) => `usess:${userId}`;

interface MemSession {
  userId: string;
  refreshHash: string;
  ttl: string;
  createdAt: string;
  rotatedAt?: string;
  ip: string;
  userAgent: string;
}

const memSession = (sid: string) => mem.get<MemSession>(sessKey(sid));
/** Sessions created while Redis was down live in memory; everything else goes to Redis. */
const inMemory = (sid: string) => mem.has(sessKey(sid)) || !isRedisReady();

interface RotateCommand {
  rotateRefresh(key: string, oldHash: string, newHash: string, now: string): Promise<[number, string]>;
}

// Atomic compare-and-rotate. Returns {1,uid} rotated | {0,''} unknown session | {-1,uid} reuse detected (session deleted).
redis.defineCommand('rotateRefresh', {
  numberOfKeys: 1,
  lua: `
    local h = redis.call('HGET', KEYS[1], 'refreshHash')
    if not h then return {0, ''} end
    local uid = redis.call('HGET', KEYS[1], 'userId')
    if h ~= ARGV[1] then
      redis.call('DEL', KEYS[1])
      return {-1, uid}
    end
    redis.call('HSET', KEYS[1], 'refreshHash', ARGV[2], 'rotatedAt', ARGV[3])
    redis.call('EXPIRE', KEYS[1], tonumber(redis.call('HGET', KEYS[1], 'ttl')))
    return {1, uid}
  `,
});

export interface SessionMeta {
  remember?: boolean;
  ip?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  /** Session (refresh token) lifetime in seconds. */
  refreshExpiresIn: number;
}

function signAccessToken(userId: string, sid: string): string {
  return jwt.sign({ sid }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

function pair(userId: string, sid: string, secret: string, ttl: number): TokenPair {
  return {
    accessToken: signAccessToken(userId, sid),
    refreshToken: `${sid}.${secret}`,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshExpiresIn: ttl,
  };
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unavailable('Session store is unavailable, please try again shortly');
  }
}

export async function createSession(userId: string, meta: SessionMeta = {}): Promise<TokenPair> {
  const sid = randomToken(16);
  const secret = randomToken(32);
  const ttl = meta.remember ? env.REFRESH_TTL_REMEMBER_SECONDS : env.REFRESH_TTL_SECONDS;

  if (!isRedisReady()) {
    const data: MemSession = {
      userId,
      refreshHash: sha256(secret),
      ttl: String(ttl),
      createdAt: String(Date.now()),
      ip: meta.ip ?? '',
      userAgent: (meta.userAgent ?? '').slice(0, 200),
    };
    mem.set(sessKey(sid), data, ttl);
    mem.sadd(userKey(userId), sid, env.REFRESH_TTL_REMEMBER_SECONDS);
    return pair(userId, sid, secret, ttl);
  }

  await guard(async () => {
    const res = await redis
      .multi()
      .hset(sessKey(sid), {
        userId,
        refreshHash: sha256(secret),
        ttl: String(ttl),
        createdAt: String(Date.now()),
        ip: meta.ip ?? '',
        userAgent: (meta.userAgent ?? '').slice(0, 200),
      })
      .expire(sessKey(sid), ttl)
      .sadd(userKey(userId), sid)
      .expire(userKey(userId), env.REFRESH_TTL_REMEMBER_SECONDS)
      .exec();
    const failed = res?.find(([err]) => err);
    if (failed) throw failed[0];
  });

  return pair(userId, sid, secret, ttl);
}

export function verifyAccessToken(token: string): { userId: string; sid: string } {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub || typeof payload.sid !== 'string') {
      throw ApiError.unauthorized('Invalid token');
    }
    return { userId: payload.sub, sid: payload.sid };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof jwt.TokenExpiredError) throw new ApiError(401, 'Access token expired', { code: 'TOKEN_EXPIRED' });
    throw ApiError.unauthorized('Invalid token');
  }
}

/** True when the session still exists in Redis and belongs to this user. */
export async function isSessionActive(sid: string, userId: string): Promise<boolean> {
  if (inMemory(sid)) return memSession(sid)?.userId === userId;
  return guard(async () => (await redis.hget(sessKey(sid), 'userId')) === userId);
}

/** Exchange a refresh token for a new pair (rotating the refresh secret). */
export async function refreshSession(refreshToken: string): Promise<{ userId: string; tokens: TokenPair }> {
  const [sid, secret] = refreshToken.split('.');
  if (!sid || !secret || sid.length !== 32) throw ApiError.unauthorized('Invalid refresh token');

  const newSecret = randomToken(32);

  if (inMemory(sid)) {
    const s = memSession(sid);
    if (!s) throw ApiError.unauthorized('Session expired, please log in again');
    if (s.refreshHash !== sha256(secret)) {
      mem.del(sessKey(sid));
      mem.srem(userKey(s.userId), sid);
      throw ApiError.unauthorized('Refresh token was already used; please log in again');
    }
    s.refreshHash = sha256(newSecret);
    s.rotatedAt = String(Date.now());
    const ttl = Number(s.ttl) || env.REFRESH_TTL_SECONDS;
    mem.expire(sessKey(sid), ttl);
    return { userId: s.userId, tokens: pair(s.userId, sid, newSecret, ttl) };
  }

  const [code, userId] = await guard(() =>
    (redis as unknown as RotateCommand).rotateRefresh(sessKey(sid), sha256(secret), sha256(newSecret), String(Date.now())),
  );

  if (code === -1) {
    await guard(() => redis.srem(userKey(userId), sid));
    throw ApiError.unauthorized('Refresh token was already used; please log in again');
  }
  if (code !== 1) throw ApiError.unauthorized('Session expired, please log in again');

  const ttl = Number(await guard(() => redis.hget(sessKey(sid), 'ttl'))) || env.REFRESH_TTL_SECONDS;
  return { userId, tokens: pair(userId, sid, newSecret, ttl) };
}

export async function revokeSession(userId: string, sid: string): Promise<boolean> {
  if (inMemory(sid)) {
    if (memSession(sid)?.userId !== userId) return false;
    mem.del(sessKey(sid));
    mem.srem(userKey(userId), sid);
    return true;
  }
  return guard(async () => {
    const owner = await redis.hget(sessKey(sid), 'userId');
    if (owner !== userId) return false;
    await redis.multi().del(sessKey(sid)).srem(userKey(userId), sid).exec();
    return true;
  });
}

/** Revoke every session of a user (optionally keeping one, e.g. the current device). */
export async function revokeAllSessions(userId: string, exceptSid?: string): Promise<number> {
  const memTargets = mem.smembers(userKey(userId)).filter((s) => s !== exceptSid);
  mem.del(...memTargets.map(sessKey));
  mem.srem(userKey(userId), ...memTargets);
  if (!isRedisReady()) return memTargets.length;

  const fromRedis = await guard(async () => {
    const sids = await redis.smembers(userKey(userId));
    const targets = sids.filter((s) => s !== exceptSid);
    if (targets.length) {
      await redis
        .multi()
        .del(...targets.map(sessKey))
        .srem(userKey(userId), ...targets)
        .exec();
    }
    return targets.length;
  });
  return memTargets.length + fromRedis;
}

export interface SessionInfo {
  id: string;
  createdAt: Date;
  ip: string;
  userAgent: string;
  current: boolean;
}

function listMemorySessions(userId: string, currentSid: string): SessionInfo[] {
  const live: SessionInfo[] = [];
  for (const sid of mem.smembers(userKey(userId))) {
    const s = memSession(sid);
    if (!s || s.userId !== userId) {
      mem.srem(userKey(userId), sid);
      continue;
    }
    live.push({ id: sid, createdAt: new Date(Number(s.createdAt)), ip: s.ip, userAgent: s.userAgent, current: sid === currentSid });
  }
  return live;
}

export async function listSessions(userId: string, currentSid: string): Promise<SessionInfo[]> {
  const fromMemory = listMemorySessions(userId, currentSid);
  const byNewest = (a: SessionInfo, b: SessionInfo) => b.createdAt.getTime() - a.createdAt.getTime();
  if (!isRedisReady()) return fromMemory.sort(byNewest);

  const fromRedis = await guard(async (): Promise<SessionInfo[]> => {
    const sids = await redis.smembers(userKey(userId));
    if (!sids.length) return [];
    const pipeline = redis.pipeline();
    sids.forEach((s) => pipeline.hgetall(sessKey(s)));
    const results = (await pipeline.exec()) ?? [];

    const live: SessionInfo[] = [];
    const dead: string[] = [];
    results.forEach(([err, h], i) => {
      const data = h as Record<string, string> | null;
      if (err || !data || !data.userId) return void dead.push(sids[i]);
      live.push({
        id: sids[i],
        createdAt: new Date(Number(data.createdAt)),
        ip: data.ip,
        userAgent: data.userAgent,
        current: sids[i] === currentSid,
      });
    });
    if (dead.length) await redis.srem(userKey(userId), ...dead); // lazy cleanup of expired sessions
    return live;
  });
  return [...fromMemory, ...fromRedis].sort(byNewest);
}
