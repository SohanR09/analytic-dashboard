import bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { memoryStore as mem } from '../config/memoryStore';
import { isRedisReady, redis } from '../config/redis';
import { ApiError } from '../utils/ApiError';
import { sendPasswordResetEmail } from '../utils/email';
import { randomToken, sha256 } from '../utils/helpers';
import type { LoginInput, RegisterInput, ResetPasswordInput } from '../validators/auth.validator';
import * as sessions from './session.service';

const RESET_TOKEN_TTL_SECONDS = 60 * 60;
const FORGOT_PASSWORD_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('shoplytics-dummy-password', env.BCRYPT_SALT_ROUNDS);

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

export const publicUser = (u: User) => {
  const { password: _password, ...rest } = u;
  return rest;
};

// ---- brute-force protection: failed logins counted per (IP + email) in Redis ----------------------------

const failKey = (ip: string | undefined, email: string) => `loginfail:${sha256(`${ip ?? ''}|${email}`).slice(0, 32)}`;

async function assertNotLocked(key: string) {
  if (!isRedisReady()) {
    if (Number(mem.get(key) ?? 0) >= env.LOGIN_MAX_FAILURES) {
      const ttl = mem.ttl(key);
      throw ApiError.tooMany('Too many failed login attempts, try again later', ttl > 0 ? ttl : env.LOGIN_LOCK_SECONDS);
    }
    return;
  }
  try {
    const count = Number((await redis.get(key)) ?? 0);
    if (count >= env.LOGIN_MAX_FAILURES) {
      const ttl = await redis.ttl(key);
      throw ApiError.tooMany('Too many failed login attempts, try again later', ttl > 0 ? ttl : env.LOGIN_LOCK_SECONDS);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err; // Redis trouble must not block logins (rate limiter + bcrypt still apply)
  }
}

async function recordFailure(key: string) {
  if (!isRedisReady()) {
    const n = mem.incr(key);
    if (n === 1 || n === env.LOGIN_MAX_FAILURES) mem.expire(key, env.LOGIN_LOCK_SECONDS);
    return;
  }
  try {
    const n = await redis.incr(key);
    if (n === 1 || n === env.LOGIN_MAX_FAILURES) await redis.expire(key, env.LOGIN_LOCK_SECONDS);
  } catch {
    /* ignore */
  }
}

// ---- use cases -------------------------------------------------------------------------------------------

export async function register(input: RegisterInput, meta: ClientMeta) {
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, password: await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS) },
  });
  const tokens = await sessions.createSession(user.id, meta);
  return { user: publicUser(user), ...tokens };
}

export async function login(input: LoginInput, meta: ClientMeta) {
  const key = failKey(meta.ip, input.email);
  await assertNotLocked(key);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user ? user.password : DUMMY_HASH);
  if (!user || !valid) {
    await recordFailure(key);
    throw ApiError.unauthorized('Invalid email or password');
  }

  mem.del(key);
  if (isRedisReady()) await redis.del(key).catch(() => undefined);
  const tokens = await sessions.createSession(user.id, { ...meta, remember: input.rememberMe });
  return { user: publicUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  const { userId, tokens } = await sessions.refreshSession(refreshToken);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    await sessions.revokeAllSessions(userId);
    throw ApiError.unauthorized('Account no longer exists');
  }
  return { user: publicUser(user), ...tokens };
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return { message: FORGOT_PASSWORD_MESSAGE };

  const token = randomToken(32);
  const resetKey = `pwreset:${sha256(token)}`; // only the hash is stored
  if (isRedisReady()) await redis.set(resetKey, user.id, 'EX', RESET_TOKEN_TTL_SECONDS);
  else mem.set(resetKey, user.id, RESET_TOKEN_TTL_SECONDS);
  // Not awaited: an SMTP round trip would make "user exists" responses measurably slower than "no such user",
  // which leaks which emails are registered. Delivery failures are logged instead.
  sendPasswordResetEmail(user.email, `${env.clientOrigins[0]}/reset-password?token=${token}`).catch((err: Error) =>
    console.error(`[email] Failed to send password-reset email: ${err.message}`),
  );

  return {
    message: FORGOT_PASSWORD_MESSAGE,
    // Development convenience only, and only while no SMTP provider is configured. Never in production.
    ...(env.NODE_ENV === 'development' && !env.smtpConfigured ? { devResetToken: token } : {}),
  };
}

export async function resetPassword(input: ResetPasswordInput) {
  const resetKey = `pwreset:${sha256(input.token)}`;
  const userId = mem.getdel<string>(resetKey) ?? (isRedisReady() ? await redis.getdel(resetKey) : null); // single use
  if (!userId) throw ApiError.badRequest('Reset link is invalid or has expired');

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS) },
  });
  await sessions.revokeAllSessions(userId); // every device must sign in again
  return { message: 'Password updated. Please log in with your new password.' };
}
