import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Badge, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Skeleton, Spinner, useToast } from '@/components/common/ui';
import { Logo } from '@/components/layout/Logo';
import { UserMenu } from '@/components/layout/UserMenu';
import { useDebounce } from '@/hooks/useDebounce';
import { businessService } from '@/services/business.service';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchBusinesses } from '@/store/slices/businessSlice';
import type { Business } from '@/types';
import { date, errorMessage } from '@/utils/format';
import { ROLE_LABEL } from '@/utils/permissions';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'SGD', 'AED'];
export const TIMEZONES = ['UTC', 'Asia/Kolkata', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];

const schema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(100),
  category: z.string().trim().min(2, 'Category is required').max(100),
  description: z.string().trim().max(1000).optional(),
  currency: z.string(), timezone: z.string(),
  website: z.string().trim().url('Enter a full URL, e.g. https://example.com').or(z.literal('')).optional(),
  logo: z.string().trim().url('Enter a full image URL').or(z.literal('')).optional(),
});
export type BusinessForm = z.infer<typeof schema>;

export function BusinessFormFields({ form, disabled }: { form: ReturnType<typeof useForm<BusinessForm>>; disabled?: boolean }) {
  const { register, formState: { errors } } = form;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" error={errors.name?.message}><input className="input" disabled={disabled} {...register('name')} /></Field>
        <Field label="Category" error={errors.category?.message}><input className="input" placeholder="e.g. Fashion retail" disabled={disabled} {...register('category')} /></Field>
      </div>
      <Field label="Description" error={errors.description?.message}><textarea className="input" rows={2} disabled={disabled} {...register('description')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency"><select className="input" disabled={disabled} {...register('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Time zone" hint="Dates and chart buckets use this zone"><select className="input" disabled={disabled} {...register('timezone')}>{TIMEZONES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website" error={errors.website?.message}><input className="input" placeholder="https://" disabled={disabled} {...register('website')} /></Field>
        <Field label="Logo URL" error={errors.logo?.message}><input className="input" placeholder="https://" disabled={disabled} {...register('logo')} /></Field>
      </div>
    </div>
  );
}
export const businessResolver = zodResolver(schema);

function BusinessModal({ open, business, onClose, onSaved }: { open: boolean; business?: Business; onClose: () => void; onSaved: (b: Business) => void }) {
  const form = useForm<BusinessForm>({ resolver: businessResolver, defaultValues: { currency: 'USD', timezone: 'UTC' } });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setError(null); form.reset(business ? { name: business.name, category: business.category, description: business.description ?? '', currency: business.currency, timezone: business.timezone, website: business.website ?? '', logo: business.logo ?? '' } : { name: '', category: '', description: '', currency: 'USD', timezone: TIMEZONES.includes(Intl.DateTimeFormat().resolvedOptions().timeZone) ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC', website: '', logo: '' }); }
  }, [open, business, form]);
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const body = { ...v, website: v.website || undefined, logo: v.logo || undefined, description: v.description || undefined };
      onSaved(business ? await businessService.update(business.id, body) : await businessService.create(body));
    } catch (e) { setError(errorMessage(e)); }
  });
  return (
    <Modal open={open} onClose={onClose} title={business ? 'Edit business' : 'Add business'} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <BusinessFormFields form={form} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Spinner />}{business ? 'Save changes' : 'Create business'}</button></div>
      </form>
    </Modal>
  );
}

export default function Businesses() {
  const dispatch = useAppDispatch();
  const nav = useNavigate();
  const toast = useToast();
  const { list, loading, error } = useAppSelector((s) => s.business);
  const [search, setSearch] = useState('');
  const q = useDebounce(search).trim().toLowerCase();
  const [modal, setModal] = useState<{ open: boolean; business?: Business }>({ open: false });
  const [del, setDel] = useState<Business | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void dispatch(fetchBusinesses()); }, [dispatch]);
  const shown = list.filter((b) => !q || b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q));

  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try { await businessService.remove(del.id); toast('success', `${del.name} deleted`); setDel(null); void dispatch(fetchBusinesses()); } catch (e) { toast('error', errorMessage(e)); } finally { setBusy(false); }
  };
  const makeDefault = async (b: Business) => { try { await businessService.setDefault(b.id); void dispatch(fetchBusinesses()); toast('success', `${b.name} is now your default`); } catch (e) { toast('error', errorMessage(e)); } };

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3"><Logo to="/businesses" /><UserMenu /></div></header>
      <main className="mx-auto max-w-6xl p-5 sm:p-8">
        <PageHeader title="Your businesses" subtitle="Choose a business to open its dashboard" actions={<button className="btn-primary" onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" />Add business</button>} />
        <div className="relative mb-6 max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input !pl-9" placeholder="Search businesses" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search businesses" /></div>
        {error && !list.length ? <div className="card"><ErrorState message={error} onRetry={() => dispatch(fetchBusinesses())} /></div>
          : loading && !list.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>
          : shown.length === 0 ? <div className="card"><EmptyState title={list.length ? 'No businesses match your search' : 'No businesses yet'} hint={list.length ? undefined : 'Create your first business to start tracking sales, revenue and inventory.'} action={!list.length ? <button className="btn-primary mt-2" onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" />Add business</button> : undefined} /></div>
          : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((b) => {
                const canEdit = b.role === 'OWNER' || b.role === 'ADMIN';
                return (
                  <article key={b.id} className="card flex flex-col p-5 transition hover:shadow-lg">
                    <div className="flex items-start gap-3">
                      {b.logo ? <img src={b.logo} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lightblue text-primary"><Building2 className="h-6 w-6" /></div>}
                      <div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{b.name}</h3><p className="truncate text-sm text-muted">{b.category}</p></div>
                      {b.isDefault && <span title="Default business"><Star className="h-4 w-4 fill-secondary text-secondary" /></span>}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone="blue">{ROLE_LABEL[b.role]}</Badge><span>{b.currency}</span><span>·</span><span>Created {date(b.createdAt)}</span></div>
                    <div className="mt-5 flex items-center gap-2">
                      <button className="btn-primary flex-1" onClick={() => nav(`/businesses/${b.id}/dashboard`)}>Open dashboard</button>
                      {!b.isDefault && <button className="btn-ghost !p-2" onClick={() => makeDefault(b)} aria-label={`Make ${b.name} default`} title="Make default"><Star className="h-4 w-4" /></button>}
                      {canEdit && <button className="btn-ghost !p-2" onClick={() => setModal({ open: true, business: b })} aria-label={`Edit ${b.name}`}><Pencil className="h-4 w-4" /></button>}
                      {b.role === 'OWNER' && <button className="btn-ghost !p-2 hover:!text-danger" onClick={() => setDel(b)} aria-label={`Delete ${b.name}`}><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </main>
      <BusinessModal open={modal.open} business={modal.business} onClose={() => setModal({ open: false })} onSaved={(b) => { setModal({ open: false }); toast('success', `${b.name} saved`); void dispatch(fetchBusinesses()); }} />
      <ConfirmDialog open={!!del} busy={busy} title="Delete business" confirmLabel="Delete permanently" message={<>This permanently deletes <b>{del?.name}</b> and all of its products, customers, orders and reports. This cannot be undone.</>} onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  );
}
