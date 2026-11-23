import { LogOut, User as UserIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { reset } from '@/store/slices/businessSlice';
import { clearDashboard } from '@/store/slices/dashboardSlice';

export function UserMenu() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const out = async () => { await dispatch(logout()); dispatch(reset()); dispatch(clearDashboard()); nav('/login'); };
  const initials = (user?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-2 rounded-full p-1 hover:bg-lightblue" onClick={() => setOpen((o) => !o)} aria-label="User menu">
        {user?.profileImage ? <img src={user.profileImage} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{initials}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-2 w-60 p-1">
          <div className="border-b border-line px-3 py-2"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs text-muted">{user?.email}</p></div>
          <Link to="/profile" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-lightblue"><UserIcon className="h-4 w-4" />Profile & security</Link>
          <button onClick={out} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-red-50"><LogOut className="h-4 w-4" />Log out</button>
        </div>
      )}
    </div>
  );
}
