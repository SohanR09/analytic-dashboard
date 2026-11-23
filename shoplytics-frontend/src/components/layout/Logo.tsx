import { Link } from 'react-router-dom';

export const LogoMark = ({ size = 32, light }: { size?: number; light?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill={light ? 'rgb(var(--primary-bright))' : 'rgb(var(--primary))'} /><path d="M7 21l5-6 4 3 7-9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="23" cy="9" r="2.4" fill="rgb(var(--secondary))" /></svg>
);
export const Logo = ({ to = '/', light }: { to?: string; light?: boolean }) => (
  <Link to={to} className="flex items-center gap-2.5 font-bold tracking-tight">
    <LogoMark light={light} /><span className={light ? 'text-white' : 'text-primary'}>Shoplytics</span>
  </Link>
);
