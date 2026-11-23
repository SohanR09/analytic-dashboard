import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/utils/format';

/**
 * Small data-fetching hook: loading / error / data / reload, ignores out-of-order responses and
 * re-fetches when `deps` change. (Keeps stale data visible while reloading to avoid flicker.)
 */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[], enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const r = await fnRef.current();
      if (id === seq.current) { setData(r); setError(null); }
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run();
    return () => { seq.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, error, loading, reload: run };
}
