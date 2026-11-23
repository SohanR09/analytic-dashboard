import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Field, Modal, Spinner } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { customerService, orderService, productService } from '@/services/resources.service';
import type { Order } from '@/types';
import { errorMessage, money } from '@/utils/format';

interface Line { productId: string; quantity: number; unitPrice: string }
const blank = (): Line => ({ productId: '', quantity: 1, unitPrice: '' });

/** Create-order form. Totals shown here are a preview only; the server computes the real ones and reserves stock. */
export function OrderModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (o: Order) => void }) {
  const { id, currency } = useBusiness();
  const products = useFetch(() => productService.list(id, { limit: 100, sortBy: 'name', order: 'asc' }), [id], open);
  const customers = useFetch(() => customerService.list(id, { limit: 100, sortBy: 'name', order: 'asc' }), [id], open);
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('0'); const [tax, setTax] = useState('0'); const [shipping, setShipping] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('card'); const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setLines([blank()]); setCustomerId(''); setDiscount('0'); setTax('0'); setShipping('0'); setPaymentMethod('card'); setPaymentStatus('PENDING'); setNotes(''); setError(null); } }, [open]);

  const byId = useMemo(() => new Map((products.data?.items ?? []).map((p) => [p.id, p])), [products.data]);
  const subtotal = lines.reduce((s, l) => { const p = byId.get(l.productId); return s + (p ? (l.unitPrice !== '' ? Number(l.unitPrice) : p.price) * l.quantity : 0); }, 0);
  const total = subtotal - Number(discount || 0) + Number(tax || 0) + Number(shipping || 0);
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const used = new Set(lines.map((l) => l.productId));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const valid = lines.filter((l) => l.productId);
    if (!valid.length) return setError('Add at least one product');
    for (const l of valid) { const p = byId.get(l.productId); if (p && l.quantity > p.stockQuantity) return setError(`Only ${p.stockQuantity} unit(s) of ${p.name} in stock`); }
    if (Number(discount) > subtotal) return setError('Discount cannot exceed the subtotal');
    setBusy(true);
    try {
      onSaved(await orderService.create(id, {
        customerId: customerId || undefined,
        items: valid.map((l) => ({ productId: l.productId, quantity: l.quantity, ...(l.unitPrice !== '' ? { unitPrice: Number(l.unitPrice) } : {}) })),
        discountAmount: Number(discount || 0), taxAmount: Number(tax || 0), shippingAmount: Number(shipping || 0),
        paymentMethod: paymentMethod || undefined, paymentStatus, notes: notes || undefined,
      }));
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create order" wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Customer (optional)"><select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Guest</option>{customers.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <div>
          <p className="label">Items</p>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const p = byId.get(l.productId);
              return (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <select aria-label="Product" className="input col-span-6" value={l.productId} onChange={(e) => set(i, { productId: e.target.value, unitPrice: '' })}>
                    <option value="">Select product…</option>
                    {products.data?.items.map((pr) => <option key={pr.id} value={pr.id} disabled={pr.stockQuantity === 0 || (used.has(pr.id) && pr.id !== l.productId)}>{pr.name} ({pr.stockQuantity} in stock)</option>)}
                  </select>
                  <input aria-label="Quantity" className="input col-span-2" type="number" min={1} max={p?.stockQuantity} value={l.quantity} onChange={(e) => set(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                  <input aria-label="Unit price" className="input col-span-3" type="number" step="0.01" min={0} placeholder={p ? String(p.price) : 'Price'} value={l.unitPrice} onChange={(e) => set(i, { unitPrice: e.target.value })} />
                  <button type="button" className="btn-ghost col-span-1 !p-2" aria-label="Remove item" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
          <button type="button" className="btn-ghost mt-2" onClick={() => setLines((ls) => [...ls, blank()])}><Plus className="h-4 w-4" />Add item</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Discount"><input className="input" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
          <Field label="Tax"><input className="input" type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} /></Field>
          <Field label="Shipping"><input className="input" type="number" min={0} step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment method"><select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{['card', 'upi', 'cash', 'bank_transfer', 'paypal'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</select></Field>
          <Field label="Payment status"><select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'PENDING' | 'PAID')}><option value="PENDING">Pending</option><option value="PAID">Paid</option></select></Field>
        </div>
        <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="flex items-center justify-between rounded-lg bg-lightblue px-4 py-3 text-sm"><span className="text-muted">Estimated total</span><b className="text-base">{money(Math.max(0, total), currency)}</b></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <Spinner />}Create order</button></div>
      </form>
    </Modal>
  );
}
