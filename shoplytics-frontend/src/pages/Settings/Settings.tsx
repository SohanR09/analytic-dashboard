import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Alert, Card, ConfirmDialog, Field, Modal, PageHeader, Spinner, useToast } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { businessService } from '@/services/business.service';
import { useAppDispatch } from '@/store';
import { activateBusiness, fetchBusinesses } from '@/store/slices/businessSlice';
import type { Category } from '@/types';
import { errorMessage } from '@/utils/format';
import { P } from '@/utils/permissions';
import { BusinessFormFields, businessResolver, type BusinessForm } from '../Businesses/Businesses';

function GeneralSettings() {
  const { business, can } = useBusiness();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const editable = can(P.BUSINESS_UPDATE);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(String(business.settings?.lowStockThreshold ?? ''));
  const form = useForm<BusinessForm>({ resolver: businessResolver });
  useEffect(() => { form.reset({ name: business.name, category: business.category, description: business.description ?? '', currency: business.currency, timezone: business.timezone, website: business.website ?? '', logo: business.logo ?? '' }); }, [business, form]);
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await businessService.update(business.id, { ...v, website: v.website || undefined, logo: v.logo || undefined, description: v.description || undefined, ...(threshold !== '' ? { settings: { lowStockThreshold: Number(threshold) } } : {}) });
      await dispatch(activateBusiness(business.id)); void dispatch(fetchBusinesses());
      toast('success', 'Settings saved');
    } catch (e) { setError(errorMessage(e)); }
  });
  return (
    <Card title="General">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        {!editable && <Alert kind="info">Only owners and admins can change business settings.</Alert>}
        <BusinessFormFields form={form} disabled={!editable} />
        <Field label="Default low-stock threshold" hint="Used for new products without their own minimum"><input className="input max-w-[180px]" type="number" min={0} disabled={!editable} value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>
        {editable && <div className="flex justify-end"><button className="btn-primary" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Spinner />}Save changes</button></div>}
      </form>
    </Card>
  );
}

function Categories() {
  const { id, can } = useBusiness();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => businessService.categories.list(id), [id]);
  const [modal, setModal] = useState<{ open: boolean; cat?: Category }>({ open: false });
  const [name, setName] = useState(''); const [desc, setDesc] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [del, setDel] = useState<Category | null>(null);
  const write = can(P.CATEGORY_WRITE);
  const openModal = (cat?: Category) => { setName(cat?.name ?? ''); setDesc(cat?.description ?? ''); setFormErr(null); setModal({ open: true, cat }); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setFormErr('Name is required');
    try {
      const body = { name: name.trim(), description: desc.trim() || undefined };
      if (modal.cat) await businessService.categories.update(id, modal.cat.id, body); else await businessService.categories.create(id, body);
      setModal({ open: false }); toast('success', 'Category saved'); void reload();
    } catch (er) { setFormErr(errorMessage(er)); }
  };
  const remove = async () => { if (!del) return; try { await businessService.categories.remove(id, del.id); toast('success', 'Category deleted'); setDel(null); void reload(); } catch (er) { toast('error', errorMessage(er)); setDel(null); } };
  return (
    <Card title="Product categories" action={write ? <button className="btn-secondary !py-1.5" onClick={() => openModal()}><Plus className="h-4 w-4" />Add</button> : undefined}>
      {error && <Alert>{error}</Alert>}
      {loading && !data && <Spinner />}
      <ul className="divide-y divide-line">
        {data?.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span><b>{c.name}</b>{c.productCount !== undefined && <span className="ml-2 text-xs text-muted">{c.productCount} products</span>}{c.description && <span className="block text-xs text-muted">{c.description}</span>}</span>
            <span className="flex gap-1">
              {write && <button className="btn-ghost !p-2" aria-label={`Edit ${c.name}`} onClick={() => openModal(c)}><Pencil className="h-4 w-4" /></button>}
              {can(P.CATEGORY_DELETE) && <button className="btn-ghost !p-2 hover:!text-danger" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></button>}
            </span>
          </li>
        ))}
        {data?.length === 0 && <li className="py-4 text-sm text-muted">No categories yet.</li>}
      </ul>
      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.cat ? 'Edit category' : 'Add category'}>
        <form onSubmit={save} className="space-y-4">
          {formErr && <Alert>{formErr}</Alert>}
          <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Description"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setModal({ open: false })}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Delete category" message={<>Delete <b>{del?.name}</b>? Products in it become uncategorized.</>} onConfirm={remove} onClose={() => setDel(null)} />
    </Card>
  );
}

function DangerZone() {
  const { business, can } = useBusiness();
  const nav = useNavigate();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  if (!can(P.BUSINESS_DELETE)) return null;
  const remove = async () => {
    setBusy(true);
    try { await businessService.remove(business.id); void dispatch(fetchBusinesses()); toast('success', 'Business deleted'); nav('/businesses'); } catch (e) { toast('error', errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Card title={<span className="text-danger">Danger zone</span>} className="border-red-200">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-lg text-sm text-muted">Permanently delete this business with all its products, customers, orders, reports and team access.</p><button className="btn-danger" onClick={() => { setConfirm(''); setOpen(true); }}>Delete business</button></div>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete business">
        <p className="text-sm text-muted">Type <b className="text-ink">{business.name}</b> to confirm. This cannot be undone.</p>
        <input className="input mt-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirm business name" />
        <div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-danger" disabled={confirm !== business.name || busy} onClick={remove}>{busy && <Spinner />}Delete forever</button></div>
      </Modal>
    </Card>
  );
}

export default function Settings() {
  return (
    <>
      <PageHeader title="Business settings" subtitle="Profile, regional settings and categories" />
      <div className="space-y-5"><GeneralSettings /><Categories /><DangerZone /></div>
    </>
  );
}
