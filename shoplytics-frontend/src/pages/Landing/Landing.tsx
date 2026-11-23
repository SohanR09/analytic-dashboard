import { BarChart3, Boxes, Coins, Lock, Users, FileDown, ArrowRight, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChart } from '@/components/charts/LineChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { Logo } from '@/components/layout/Logo';
import { useAppSelector } from '@/store';

const sample = Array.from({ length: 12 }, (_, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}`, revenue: 18000 + Math.round(Math.sin(i / 1.6) * 5000 + i * 1800), orders: 90 + i * 9 + (i % 3) * 8 }));
const FEATURES = [
  { icon: Building2, title: 'Multi-business', text: 'Run several businesses from one login, each with its own data, team and settings.' },
  { icon: BarChart3, title: 'Sales analytics', text: 'Orders, units and average order value with period-over-period growth.' },
  { icon: Coins, title: 'Revenue insight', text: 'Gross vs net revenue, discounts, refunds, tax and payment method mix.' },
  { icon: Boxes, title: 'Inventory control', text: 'Stock levels, low-stock alerts, stock value and a full movement log.' },
  { icon: Users, title: 'Customer segments', text: 'High-value, regular and inactive customers, plus lifetime value.' },
  { icon: FileDown, title: 'Exportable reports', text: '17 report types, downloadable as CSV or PDF.' },
];

export default function Landing() {
  const authed = useAppSelector((s) => s.auth.status === 'authenticated');
  return (
    <div className="min-h-full bg-white">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Logo />
          <nav className="hidden gap-8 text-sm font-medium text-muted md:flex"><a href="#features" className="hover:text-ink">Features</a><a href="#benefits" className="hover:text-ink">Benefits</a><a href="#preview" className="hover:text-ink">Preview</a></nav>
          <div className="flex gap-2">
            {authed ? <Link className="btn-primary" to="/businesses">Open app</Link> : <><Link className="btn-ghost" to="/login">Log in</Link><Link className="btn-primary" to="/register">Get started</Link></>}
          </div>
        </div>
      </header>

      <section className="surface-brand relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-secondary">E-commerce analytics</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Understand every business you run, <span className="text-secondary">in one dashboard.</span></h1>
            <p className="mt-4 max-w-lg text-lg text-white/75">Shoplytics turns orders, products and customers into clear revenue, sales and inventory insight, with access control that fits your team.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link className="btn-accent !px-6 !py-3" to="/register">Start free <ArrowRight className="h-4 w-4" /></Link><Link className="btn-glass !px-6 !py-3" to="/login">Log in</Link></div>
          </div>
          <div id="preview" className="card p-4 text-ink shadow-2xl shadow-black/30">
            <p className="mb-2 px-1 text-xs font-semibold text-muted">Revenue overview (sample data)</p>
            <LineChart data={sample} series={[{ key: 'revenue', label: 'Revenue' }]} area height={240} format={(n) => `$${(n / 1000).toFixed(0)}k`} xFormat={(s) => new Date(`${s}-01`).toLocaleDateString(undefined, { month: 'short' })} />
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-bold">Everything you need to read your numbers</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted">One platform for analytics, catalog and team, built around how store owners actually work.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="mb-3 inline-flex rounded-lg bg-lightblue p-2.5 text-primary"><Icon className="h-5 w-5" /></div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted">{text}</p></div>
          ))}
        </div>
      </section>

      <section id="benefits" className="bg-lightblue/60">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">Built for teams, safe by design</h2>
            <ul className="mt-6 space-y-4 text-sm">
              {[['Role-based access', 'Owners, admins, managers and analysts each see and do only what they should.'], ['Strict data isolation', 'Every business is walled off. Nobody can reach data they are not a member of.'], ['Instant session control', 'Log out of any device and access ends immediately.']].map(([t, d]) => (
                <li key={t} className="flex gap-3"><Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span><b>{t}.</b> <span className="text-muted">{d}</span></span></li>
              ))}
            </ul>
          </div>
          <div className="card p-4"><DonutChart data={[{ label: 'Delivered', value: 62 }, { label: 'Shipped', value: 14 }, { label: 'Processing', value: 12 }, { label: 'Pending', value: 8 }, { label: 'Cancelled', value: 4 }]} height={220} center={<><span className="text-2xl font-bold">100</span><span className="text-xs text-muted">orders</span></>} /></div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="surface-brand rounded-3xl px-6 py-12">
          <h2 className="text-3xl font-bold">Ready to see your business clearly?</h2>
          <p className="mx-auto mt-2 max-w-md text-white/70">Create an account and add your first business in under a minute.</p>
          <Link className="btn-accent mt-6 !px-6 !py-3" to="/register">Create your account</Link>
        </div>
      </section>
      <footer className="border-t border-line py-8 text-center text-sm text-muted">© {new Date().getFullYear()} Shoplytics. All rights reserved.</footer>
    </div>
  );
}
