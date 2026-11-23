import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageSpinner } from '@/components/common/ui';
import { useAppSelector } from '@/store';
import { useBusiness } from '@/hooks/useBusiness';
import { ErrorState } from '@/components/common/ui';

export function RequireAuth() {
  const status = useAppSelector((s) => s.auth.status);
  const loc = useLocation();
  if (status === 'idle' || status === 'loading') return <FullPageSpinner />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <Outlet />;
}

/** Login/register pages bounce signed-in users to the app. */
export function GuestOnly() {
  const status = useAppSelector((s) => s.auth.status);
  if (status === 'idle' || status === 'loading') return <FullPageSpinner />;
  return status === 'authenticated' ? <Navigate to="/businesses" replace /> : <Outlet />;
}

/** Route-level permission gate (the API enforces it too; this avoids showing a page that can only 403). */
export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useBusiness();
  if (!can(permission)) return <div className="card mx-auto mt-10 max-w-md"><ErrorState message="Your role doesn't have access to this page." /></div>;
  return <>{children}</>;
}
