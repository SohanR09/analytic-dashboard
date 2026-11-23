import type { Request, RequestHandler } from 'express';
import { env } from '../config/env';
import { consume } from '../services/ratelimit.service';
import { ApiError } from '../utils/ApiError';

interface Options {
  /** Namespace for the counter, e.g. "auth". */
  name: string;
  windowSec: number;
  max: number;
  /** Which client the limit applies to. Defaults to the IP address. Return undefined to skip limiting. */
  key?: (req: Request) => string | undefined;
  message?: string;
}

export function rateLimit(opts: Options): RequestHandler {
  return async (req, res, next) => {
    if (!env.RATE_LIMIT_ENABLED) return next();
    const id = opts.key ? opts.key(req) : req.ip;
    if (!id) return next();

    const r = await consume(`rl:${opts.name}:${id}`, opts.max, opts.windowSec);
    res.setHeader('RateLimit-Limit', String(r.limit));
    res.setHeader('RateLimit-Remaining', String(r.remaining));
    res.setHeader('RateLimit-Reset', String(r.resetSeconds));

    if (!r.allowed) {
      return next(ApiError.tooMany(opts.message ?? 'Too many requests, please slow down', r.resetSeconds));
    }
    next();
  };
}

const perUser = (req: Request) => req.user?.id ?? req.ip;

/**
 * Tiers (all backed by Redis, shared across API instances):
 *  global    - every request, per IP                        300 / min
 *  auth      - register / login / reset, per IP             20 / 15 min   (plus per-account login lockout)
 *  forgot    - password reset requests, per IP              5 / hour
 *  refresh   - token refresh, per IP                        60 / 15 min
 *  user      - all authenticated API calls, per user        600 / min
 *  analytics - expensive analytics endpoints, per user      120 / min
 *  heavy     - report generation + exports, per user        10 / min
 */
export const limiters = {
  global: rateLimit({ name: 'global', windowSec: 60, max: 300 }),
  auth: rateLimit({ name: 'auth', windowSec: 15 * 60, max: 20, message: 'Too many authentication attempts, try again later' }),
  forgot: rateLimit({ name: 'forgot', windowSec: 60 * 60, max: 5, message: 'Too many password reset requests, try again later' }),
  refresh: rateLimit({ name: 'refresh', windowSec: 15 * 60, max: 60 }),
  user: rateLimit({ name: 'user', windowSec: 60, max: 600, key: perUser }),
  analytics: rateLimit({ name: 'analytics', windowSec: 60, max: 120, key: perUser }),
  heavy: rateLimit({ name: 'heavy', windowSec: 60, max: 10, key: perUser, message: 'Report limit reached, try again in a minute' }),
};
