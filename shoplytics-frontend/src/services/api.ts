import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiEnvelope, AuthResult, TokenPair } from '@/types';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000/api/v1';

/**
 * Token handling
 *  - access token: memory only (never persisted)
 *  - refresh token: localStorage when "remember me", otherwise sessionStorage
 * Refresh tokens are single-use on the server, so concurrent 401s share ONE in-flight refresh.
 */
const RT_KEY = 'shoplytics.rt';
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

const read = (s: Storage) => { try { return s.getItem(RT_KEY); } catch { return null; } };
export const tokens = {
  get access() { return accessToken; },
  get refresh() { return read(localStorage) ?? read(sessionStorage); },
  set(pair: TokenPair, remember?: boolean) {
    accessToken = pair.accessToken;
    const persistent = remember ?? read(localStorage) !== null;
    try {
      (persistent ? localStorage : sessionStorage).setItem(RT_KEY, pair.refreshToken);
      (persistent ? sessionStorage : localStorage).removeItem(RT_KEY);
    } catch { /* storage unavailable: session lasts until reload */ }
  },
  clear() {
    accessToken = null;
    try { localStorage.removeItem(RT_KEY); sessionStorage.removeItem(RT_KEY); } catch { /* ignore */ }
  },
};
export const setSessionLostHandler = (fn: () => void) => { onSessionLost = fn; };

export const api = axios.create({ baseURL: API_URL, timeout: 30_000 });

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (tokens.access) cfg.headers.Authorization = `Bearer ${tokens.access}`;
  return cfg;
});

let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const rt = tokens.refresh;
  if (!rt) return Promise.resolve(false);
  refreshing = axios
    .post<ApiEnvelope<TokenPair>>(`${API_URL}/auth/refresh`, { refreshToken: rt })
    .then((r) => { tokens.set(r.data.data); return true; })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

/**
 * Fired after any successful write that can change stock levels (products, inventory, orders),
 * so listeners like the stock-alerts bell can refresh without each page having to remember to.
 */
export const STOCK_CHANGED = 'shoplytics:stock-changed';
const STOCK_WRITE = /\/businesses\/[^/]+\/(products|inventory|orders)(\/|$)/;

api.interceptors.response.use(
  (r) => {
    const method = r.config.method?.toLowerCase();
    if (method && method !== 'get' && STOCK_WRITE.test(r.config.url ?? '')) window.dispatchEvent(new Event(STOCK_CHANGED));
    return r;
  },
  async (error: AxiosError<{ message?: string; details?: { code?: string } }>) => {
    const cfg = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = cfg?.url?.startsWith('/auth/login') || cfg?.url?.startsWith('/auth/refresh') || cfg?.url?.startsWith('/auth/register');
    if (error.response?.status === 401 && cfg && !cfg._retried && !isAuthCall) {
      cfg._retried = true;
      const revoked = error.response.data?.details?.code === 'SESSION_REVOKED';
      if (!revoked && (await refreshSession())) return api(cfg);
      tokens.clear();
      onSessionLost?.();
    }
    return Promise.reject(error);
  },
);

/** Unwraps `{success, data}`; list endpoints also return `meta`. */
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const r = await api.get<ApiEnvelope<T>>(url, { params: clean(params) });
  return r.data.data;
}
export async function getPaged<T>(url: string, params?: Record<string, unknown>): Promise<{ items: T[]; meta: import('@/types').PageMeta }> {
  const r = await api.get<ApiEnvelope<T[]>>(url, { params: clean(params) });
  return { items: r.data.data, meta: r.data.meta ?? { page: 1, limit: r.data.data.length, total: r.data.data.length, totalPages: 1 } };
}
export const post = async <T>(url: string, body?: unknown) => (await api.post<ApiEnvelope<T>>(url, body)).data.data;
export const put = async <T>(url: string, body?: unknown) => (await api.put<ApiEnvelope<T>>(url, body)).data.data;
export const del = async <T = { message: string }>(url: string) => (await api.delete<ApiEnvelope<T>>(url)).data.data;

function clean(p?: Record<string, unknown>) {
  if (!p) return p;
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

export type { AuthResult };
