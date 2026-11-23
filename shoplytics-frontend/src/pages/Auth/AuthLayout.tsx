import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="surface-brand hidden flex-col justify-between p-12 lg:flex">
        <Logo light />
        <div>
          <h2 className="max-w-md text-3xl font-bold leading-tight">Every business. <span className="text-secondary">One clear view.</span></h2>
          <p className="mt-4 max-w-md text-white/70">Track sales, revenue, inventory and customers across all your businesses, with role-based access for your whole team.</p>
        </div>
        <p className="text-sm text-white/50">© {new Date().getFullYear()} Shoplytics</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
