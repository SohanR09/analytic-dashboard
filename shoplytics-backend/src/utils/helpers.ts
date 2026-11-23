import crypto from 'crypto';

/** Round to a fixed number of decimals (default 2) - used for money and percentages. */
export const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
export const isObjectId = (value: unknown): value is string => typeof value === 'string' && OBJECT_ID.test(value);

/** Percentage change; `null` when there is no baseline (previous = 0, current > 0). */
export function growth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return round(((current - previous) / Math.abs(previous)) * 100);
}
