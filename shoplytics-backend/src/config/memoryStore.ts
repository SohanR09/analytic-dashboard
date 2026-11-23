/**
 * Minimal in-process key/value store with TTLs, used as a fallback while Redis is unavailable.
 * Only what the services need: strings/counters, hashes (objects) and sets. Single-process only -
 * data is not shared between API instances and is lost on restart.
 */

interface Entry {
  value: unknown;
  expiresAt?: number;
}

class MemoryStore {
  private data = new Map<string, Entry>();

  constructor() {
    // Periodically drop expired entries so the map does not grow unbounded.
    setInterval(() => {
      const now = Date.now();
      for (const [k, e] of this.data) if (e.expiresAt !== undefined && e.expiresAt <= now) this.data.delete(k);
    }, 60_000).unref();
  }

  private entry(key: string): Entry | undefined {
    const e = this.data.get(key);
    if (!e) return undefined;
    if (e.expiresAt !== undefined && e.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  get<T = string>(key: string): T | null {
    return (this.entry(key)?.value as T) ?? null;
  }

  has(key: string): boolean {
    return this.entry(key) !== undefined;
  }

  set(key: string, value: unknown, ttlSec?: number): void {
    this.data.set(key, { value, expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : undefined });
  }

  del(...keys: string[]): void {
    keys.forEach((k) => this.data.delete(k));
  }

  getdel<T = string>(key: string): T | null {
    const v = this.get<T>(key);
    this.data.delete(key);
    return v;
  }

  incr(key: string): number {
    const e = this.entry(key);
    const n = Number(e?.value ?? 0) + 1;
    this.data.set(key, { value: n, expiresAt: e?.expiresAt });
    return n;
  }

  decr(key: string): number {
    const e = this.entry(key);
    const n = Number(e?.value ?? 0) - 1;
    this.data.set(key, { value: n, expiresAt: e?.expiresAt });
    return n;
  }

  expire(key: string, ttlSec: number): void {
    const e = this.entry(key);
    if (e) e.expiresAt = Date.now() + ttlSec * 1000;
  }

  expireMs(key: string, ttlMs: number): void {
    const e = this.entry(key);
    if (e) e.expiresAt = Date.now() + ttlMs;
  }

  /** Remaining TTL in seconds; -1 = no expiry, -2 = missing (same as Redis TTL). */
  ttl(key: string): number {
    const e = this.entry(key);
    if (!e) return -2;
    if (e.expiresAt === undefined) return -1;
    return Math.ceil((e.expiresAt - Date.now()) / 1000);
  }

  // ---- sets ----
  sadd(key: string, member: string, ttlSec?: number): void {
    const e = this.entry(key);
    const set = (e?.value as Set<string>) ?? new Set<string>();
    set.add(member);
    this.data.set(key, { value: set, expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : e?.expiresAt });
  }

  srem(key: string, ...members: string[]): void {
    const set = this.get<Set<string>>(key);
    members.forEach((m) => set?.delete(m));
  }

  smembers(key: string): string[] {
    return [...(this.get<Set<string>>(key) ?? [])];
  }
}

export const memoryStore = new MemoryStore();
