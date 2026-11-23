import { useMemo } from 'react';
import { useAppSelector } from '@/store';

/** The active business plus helpers for permission-gated UI. Only valid below <BusinessLayout/>. */
export function useBusiness() {
  const business = useAppSelector((s) => s.business.active)!;
  return useMemo(() => {
    const perms = new Set(business?.permissions ?? []);
    return { business, id: business?.id, currency: business?.currency ?? 'USD', role: business?.role, can: (p: string) => perms.has(p) };
  }, [business]);
}
export const useFilters = () => useAppSelector((s) => s.filters);
