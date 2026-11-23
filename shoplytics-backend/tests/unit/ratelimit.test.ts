import { describe, expect, it } from 'vitest';
import { consume } from '../../src/services/ratelimit.service';

const uid = () => `t:${Math.random().toString(36).slice(2)}`;

describe('sliding-window rate limiter (Redis)', () => {
  it('allows up to the limit, then blocks', async () => {
    const key = uid();
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await consume(key, 5, 60));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results[0].remaining).toBe(4);
    expect(results[4].remaining).toBe(0);
    expect(results[5].resetSeconds).toBeGreaterThanOrEqual(1);
    expect(results[5].resetSeconds).toBeLessThanOrEqual(60);
  });

  it('keeps clients independent', async () => {
    const a = uid();
    const b = uid();
    for (let i = 0; i < 3; i++) await consume(a, 3, 60);
    expect((await consume(a, 3, 60)).allowed).toBe(false);
    expect((await consume(b, 3, 60)).allowed).toBe(true);
  });

  it('is atomic under concurrency: exactly `limit` of N parallel requests pass', async () => {
    const key = uid();
    const results = await Promise.all(Array.from({ length: 60 }, () => consume(key, 10, 60)));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
  });

  it('does not count rejected requests, and recovers once the window has passed', async () => {
    const key = uid();
    for (let i = 0; i < 3; i++) await consume(key, 3, 1);
    for (let i = 0; i < 20; i++) expect((await consume(key, 3, 1)).allowed).toBe(false); // hammering while blocked
    await new Promise((r) => setTimeout(r, 2200)); // > 2 windows: both counters have aged out
    expect((await consume(key, 3, 1)).allowed).toBe(true);
  });

  it('weights the previous window (no 2x burst at the window boundary)', async () => {
    const key = uid();
    // Wait until we are right at the start of a fresh 2s window, fill it, then step into the next one.
    const windowMs = 2000;
    await new Promise((r) => setTimeout(r, windowMs - (Date.now() % windowMs) + 20));
    for (let i = 0; i < 10; i++) expect((await consume(key, 10, 2)).allowed).toBe(true);
    await new Promise((r) => setTimeout(r, windowMs - (Date.now() % windowMs) + 20)); // just after the boundary
    // A fixed window would now allow 10 more immediately; the sliding estimate still counts ~all the previous hits.
    const burst = await Promise.all(Array.from({ length: 10 }, () => consume(key, 10, 2)));
    expect(burst.filter((r) => r.allowed).length).toBeLessThanOrEqual(2);
  });
});
