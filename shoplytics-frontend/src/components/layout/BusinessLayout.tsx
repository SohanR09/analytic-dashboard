import { BarChart3, Boxes, Coins, LayoutDashboard, Menu, Package, PanelLeftClose, PanelLeftOpen, Settings, ShoppingCart, Users, UserCog, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorState, FullPageSpinner, Badge, cx } from '@/components/common/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { activateBusiness, fetchBusinesses } from '@/store/slices/businessSlice';
import { ROLE_LABEL, P } from '@/utils/permissions';
import { BusinessSwitcher } from './BusinessSwitcher';
import { DateFilter } from './DateFilter';
import { Logo, LogoMark } from './Logo';
import { Notifications } from './Notifications';
import { UserMenu } from './UserMenu';

const NAV = [
  { to: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: 'sales', label: 'Sales Analytics', icon: BarChart3 },
  { to: 'revenue', label: 'Revenue Analytics', icon: Coins },
  { to: 'inventory', label: 'Inventory', icon: Boxes },
  { to: 'products', label: 'Products', icon: Package },
  { to: 'customers', label: 'Customers', icon: Users },
  { to: 'orders', label: 'Orders', icon: ShoppingCart },
  { to: 'reports', label: 'Reports', icon: FileText },
  { to: 'team', label: 'Team', icon: UserCog, perm: P.MEMBER_READ },
  { to: 'settings', label: 'Business Settings', icon: Settings },
];
const ANALYTIC_PAGES = ['dashboard', 'sales', 'revenue', 'customers', 'reports'];
const COLLAPSE_KEY = 'shoplytics.sidebarCollapsed';
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } };

/** Loads the business named in the URL (this also tells us the caller's role/permissions) and renders the app shell. */
export function BusinessLayout() {
  const { businessId = '' } = useParams();
  const dispatch = useAppDispatch();
  const nav = useNavigate();
  const { active, error, list } = useAppSelector((s) => s.business);
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const page = useLocation().pathname.split('/')[3] ?? '';

  useEffect(() => { if (!list.length) void dispatch(fetchBusinesses()); }, [dispatch, list.length]);
  useEffect(() => { void dispatch(activateBusiness(businessId)); }, [dispatch, businessId]);
  useEffect(() => { setMenu(false); }, [page]);
  useEffect(() => { try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* storage unavailable */ } }, [collapsed]);

  if (error && !active) {
    return (
      <div className="mx-auto max-w-md py-24">
        <ErrorState message={error === 'Business not found' ? "This business doesn't exist or you don't have access to it." : error} onRetry={() => nav('/businesses')} />
        <p className="text-center text-sm text-muted">Use “Try again” to go back to your businesses.</p>
      </div>
    );
  }
  if (!active || active.id !== businessId) return <FullPageSpinner />;

  const perms = new Set(active.permissions ?? []);
  const items = NAV.filter((n) => !n.perm || perms.has(n.perm));

  /** `mini` = collapsed desktop rail (icons only). The mobile drawer always renders the full version. */
  const renderSidebar = (mini: boolean) => (
    <nav className="surface-brand flex h-full flex-col">
      <div className={cx('flex items-center py-5', mini ? 'flex-col gap-4 px-2' : 'justify-between px-5')}>
        {mini ? <Link to="/businesses" aria-label="Shoplytics home"><LogoMark light /></Link> : <Logo to="/businesses" light />}
        <button className="lg:hidden" onClick={() => setMenu(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        <button
          className="hidden rounded-md p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white lg:block"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={mini ? 'Expand sidebar' : 'Collapse sidebar'}
          title={mini ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {mini ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>
      <div className={mini ? 'px-2' : 'px-3'}>
        {!mini && <p className="truncate px-3 pb-2 text-xs uppercase tracking-wider text-white/50">{active.name}</p>}
        <ul className="space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={`/businesses/${businessId}/${to}`}
                title={mini ? label : undefined}
                aria-label={mini ? label : undefined}
                className={({ isActive }) => cx(
                  'relative flex items-center rounded-lg py-2.5 text-sm transition',
                  mini ? 'justify-center' : 'gap-3 px-3',
                  isActive
                    ? 'bg-white/15 font-semibold text-white ring-1 ring-inset ring-white/10 before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-secondary'
                    : 'font-medium text-white/60 hover:bg-white/10 hover:text-white',
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cx('h-[18px] w-[18px] shrink-0', isActive && 'text-secondary')} />
                    {!mini && <span className="truncate">{label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      {!mini && <div className="mt-auto p-4"><div className="rounded-xl bg-white/10 p-3 text-xs"><p className="text-white/60">Your role</p><p className="mt-0.5 font-semibold">{ROLE_LABEL[active.role]}</p></div></div>}
    </nav>
  );

  return (
    <div className="flex h-full">
      <aside className={cx('hidden shrink-0 overflow-hidden transition-[width] duration-200 lg:block', collapsed ? 'w-[72px]' : 'w-64')}>{renderSidebar(collapsed)}</aside>
      {menu && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-primary-dark/50" onClick={() => setMenu(false)} /><div className="absolute inset-y-0 left-0 w-64">{renderSidebar(false)}</div></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <button className="btn-ghost !p-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <BusinessSwitcher />
          <Badge tone="blue">{ROLE_LABEL[active.role]}</Badge>
          <div className="ml-auto flex items-center gap-3">
            {ANALYTIC_PAGES.includes(page) && <DateFilter />}
            <Notifications />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6"><Outlet key={businessId} /></div></main>
      </div>
    </div>
  );
}
